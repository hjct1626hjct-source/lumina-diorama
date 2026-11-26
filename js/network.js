// ============================================================================
// LUMINA DIORAMA — Serverless 4-Player Online Co-op via PeerJS (WebRTC P2P)
// Room ID Lobby, Smooth Lerp Sync, Shared Loot/EXP, AoE Buff/Heal, Revive & Chat
// 製作者：駿 (Created by Shun)
// ============================================================================

const ROOM_PREFIX = 'lumina-diorama-v1-';
const MAX_PLAYERS = 4;

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function sanitizeRoomCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export class NetworkManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.role = 'solo'; // 'solo' | 'host' | 'client'
    this.roomCode = '';
    this.peerId = '';
    this.connected = false;
    this.statusText = 'ソロプレイ中';

    // Host holds connections to up to 3 guests; Client holds 1 connection to host
    this.connections = new Map(); // peerId -> DataConnection
    this.remotePlayers = new Map(); // peerId -> RemotePlayerState

    this.syncTimer = 0;
    this.reconnectAttempts = 0;
    this.lastRoomCode = '';
    this.onStatusChange = null;
  }

  _notifyStatus(text) {
    this.statusText = text;
    if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
  }

  getStatusInfo() {
    return {
      role: this.role,
      connected: this.connected,
      roomCode: this.roomCode,
      statusText: this.statusText,
      partyCount: 1 + this.remotePlayers.size,
      members: [
        {
          id: this.peerId || 'local',
          name: this.game.player.name,
          jobId: this.game.player.jobId,
          level: this.game.player.level,
          isHost: this.role === 'host',
          isLocal: true,
        },
        ...Array.from(this.remotePlayers.values()).map((rp) => ({
          id: rp.id,
          name: rp.name,
          jobId: rp.jobId,
          level: rp.level,
          isHost: rp.isHost,
          isLocal: false,
        })),
      ],
    };
  }

  isMultiplayer() {
    return this.role !== 'solo' && this.connected;
  }

  _ensurePeerLib() {
    if (typeof window.Peer === 'undefined') {
      this._notifyStatus('通信ライブラリ(PeerJS)を読み込めませんでした。オフライン/ソロで遊べます。');
      this.game.addToast('⚠ オンライン通信ライブラリ未接続（ソロでそのまま遊べます）');
      return false;
    }
    return true;
  }

  hostRoom(customCode = '') {
    if (!this._ensurePeerLib()) return;
    this.disconnect(true);

    const code = sanitizeRoomCode(customCode) || generateRoomCode();
    if (code.length < 4) {
      this._notifyStatus('合言葉は4〜6文字の英数字で入力してください。');
      return;
    }
    this.role = 'host';
    this.roomCode = code;
    this.lastRoomCode = code;
    this._notifyStatus(`ルーム [${code}] を開設中...`);

    const fullId = `${ROOM_PREFIX}${code}`;
    try {
      this.peer = new window.Peer(fullId, { debug: 0 });
    } catch (err) {
      this._notifyStatus(`ルーム開設エラー: ${err.message}`);
      this.role = 'solo';
      return;
    }

    this.peer.on('open', (id) => {
      this.peerId = id;
      this.connected = true;
      this._notifyStatus(`ルーム [${code}] 開設完了！友達を待っています (1/${MAX_PLAYERS})`);
      this.game.addToast(`🌐 ルーム [${code}] を開設しました！`);
      this.game.ui.addChatMessage('SYSTEM', `ルーム [${code}] を開設しました。合言葉を友達に共有しよう！`, true);
      this.game.unlockAchievement('coop_hero');
    });

    this.peer.on('connection', (conn) => {
      if (this.connections.size >= MAX_PLAYERS - 1) {
        conn.on('open', () => {
          conn.send({ type: 'room_full' });
          setTimeout(() => conn.close(), 200);
        });
        return;
      }
      this._setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        this._notifyStatus(`合言葉 [${code}] は既に使われています。別の合言葉をお試しください。`);
      } else {
        this._notifyStatus(`通信エラー: ${err.type || err.message}`);
      }
      this.connected = false;
      this.role = 'solo';
      if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
    });
  }

  joinRoom(rawCode) {
    if (!this._ensurePeerLib()) return;
    const code = sanitizeRoomCode(rawCode);
    if (code.length < 4) {
      this._notifyStatus('合言葉（4〜6文字）を入力してください。');
      return;
    }

    this.disconnect(true);
    this.role = 'client';
    this.roomCode = code;
    this.lastRoomCode = code;
    this.reconnectAttempts = 0;
    this._notifyStatus(`ルーム [${code}] へ接続中...`);

    try {
      this.peer = new window.Peer(undefined, { debug: 0 });
    } catch (err) {
      this._notifyStatus(`接続初期化エラー: ${err.message}`);
      this.role = 'solo';
      return;
    }

    this.peer.on('open', (id) => {
      this.peerId = id;
      const hostConn = this.peer.connect(`${ROOM_PREFIX}${code}`, { reliable: true });
      this._setupConnection(hostConn, true);
    });

    this.peer.on('error', (err) => {
      this._notifyStatus(`ルーム [${code}] に接続できませんでした (${err.type || 'offline'})`);
      this.connected = false;
      this.role = 'solo';
      if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
    });
  }

  _setupConnection(conn, isToHost = false) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.connected = true;
      this.reconnectAttempts = 0;

      // Send immediate handshake state
      conn.send(this._buildLocalStatePacket('hello'));

      if (isToHost) {
        this._notifyStatus(`ルーム [${this.roomCode}] に合流しました！`);
        this.game.addToast(`🌐 ルーム [${this.roomCode}] に合流！最大4人で無双しよう！`);
        this.game.ui.addChatMessage('SYSTEM', `ルーム [${this.roomCode}] に合流しました！`, true);
        this.game.unlockAchievement('coop_hero');
      } else {
        this._notifyStatus(`ルーム [${this.roomCode}] 接続中 (${1 + this.connections.size}/${MAX_PLAYERS})`);
      }
      if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
    });

    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      this._handleIncomingPacket(conn.peer, msg);
    });

    conn.on('close', () => {
      const rp = this.remotePlayers.get(conn.peer);
      const name = rp ? rp.name : 'プレイヤー';
      this.connections.delete(conn.peer);
      this.remotePlayers.delete(conn.peer);

      if (this.role === 'host') {
        this._broadcastRaw({ type: 'peer_left', peerId: conn.peer, name });
        this.game.addToast(`👋 ${name} が退出しました`);
        this.game.ui.addChatMessage('SYSTEM', `${name} がパーティーから退出しました。`, true);
        this._notifyStatus(`ルーム [${this.roomCode}] 接続中 (${1 + this.connections.size}/${MAX_PLAYERS})`);
      } else if (this.role === 'client') {
        this.connected = false;
        this.game.addToast('⚠ ホストとの通信が切断されました');
        this.game.ui.addChatMessage('SYSTEM', 'ホストとの通信が切断されました。自動復帰を試みます...', true);
        this._attemptClientReconnect();
      }
      if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
    });

    conn.on('error', () => {
      // Handled by close fallback
    });
  }

  _attemptClientReconnect() {
    if (this.role !== 'client' || !this.lastRoomCode) return;
    if (this.reconnectAttempts >= 2) {
      this._notifyStatus('接続が切れました（ソロモードへ安全に復帰しました）');
      this.game.ui.addChatMessage('SYSTEM', 'ソロモードへ安全に復帰しました（進行データはすべて保持されています）', true);
      this.disconnect(true);
      return;
    }
    this.reconnectAttempts += 1;
    this._notifyStatus(`再接続を試行中 (${this.reconnectAttempts}/2)...`);
    setTimeout(() => {
      if (this.role === 'client' && this.peer && !this.peer.destroyed) {
        const hostConn = this.peer.connect(`${ROOM_PREFIX}${this.lastRoomCode}`, { reliable: true });
        this._setupConnection(hostConn, true);
      }
    }, 1800);
  }

  disconnect(silent = false) {
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (_) {}
    }
    this.connections.clear();
    this.remotePlayers.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    const wasActive = this.role !== 'solo';
    this.role = 'solo';
    this.connected = false;
    this.roomCode = '';
    this._notifyStatus('ソロプレイ中');
    if (wasActive && !silent) {
      this.game.addToast('ルームから退出しました（ソロモード）');
    }
  }

  _buildLocalStatePacket(type = 'state') {
    const p = this.game.player;
    const st = p.getStats();
    return {
      type,
      peerId: this.peerId || 'local',
      isHost: this.role === 'host',
      name: p.name,
      jobId: p.jobId,
      level: p.level,
      areaId: this.game.currentAreaId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      facing: Number(p.facing.toFixed(2)),
      hp: Math.round(p.hp),
      maxHp: st.maxHp,
      downed: p.downed,
      downedTimer: Math.round(p.downedTimer),
      weaponColor: st.weaponColor,
      weaponPlus: st.weaponPlus,
      droneX: Math.round(p.drone.x),
      droneY: Math.round(p.drone.y),
    };
  }

  _broadcastRaw(packet, excludePeerId = null) {
    for (const [pid, conn] of this.connections.entries()) {
      if (pid === excludePeerId) continue;
      if (conn.open) {
        try { conn.send(packet); } catch (_) {}
      }
    }
  }

  broadcast(packet) {
    if (!this.isMultiplayer()) return;
    packet.fromId = this.peerId;
    this._broadcastRaw(packet);
  }

  _handleIncomingPacket(senderConnId, msg) {
    // Host relays packets to all other clients so everyone stays synced in Star topology
    if (this.role === 'host' && msg.type !== 'room_full') {
      const relay = { ...msg, peerId: msg.peerId || senderConnId };
      this._broadcastRaw(relay, senderConnId);
    }

    const pid = msg.peerId || msg.fromId || senderConnId;
    if (pid === this.peerId) return;

    switch (msg.type) {
      case 'room_full': {
        this.game.addToast('⚠ このルームは満員（最大4人）です');
        this.disconnect(true);
        break;
      }
      case 'hello':
      case 'state': {
        let rp = this.remotePlayers.get(pid);
        const isNew = !rp;
        if (!rp) {
          rp = {
            id: pid,
            name: msg.name || '仲間',
            jobId: msg.jobId || 'knight',
            isHost: Boolean(msg.isHost),
            level: msg.level || 1,
            areaId: msg.areaId || 'town',
            x: msg.x || 300,
            y: msg.y || 300,
            targetX: msg.x || 300,
            targetY: msg.y || 300,
            facing: msg.facing || 0,
            targetFacing: msg.facing || 0,
            hp: msg.hp ?? 100,
            maxHp: msg.maxHp ?? 100,
            downed: Boolean(msg.downed),
            downedTimer: msg.downedTimer ?? 30,
            weaponColor: msg.weaponColor || '#38f8d4',
            weaponPlus: msg.weaponPlus || 0,
            droneX: msg.droneX || msg.x || 300,
            droneY: msg.droneY || msg.y || 300,
            targetDroneX: msg.droneX || msg.x || 300,
            targetDroneY: msg.droneY || msg.y || 300,
            reviveProgress: 0,
            chatBubble: null,
          };
          this.remotePlayers.set(pid, rp);
          if (isNew) {
            this.game.addToast(`✨ ${rp.name} がパーティーに合流しました！`);
            this.game.ui.addChatMessage('SYSTEM', `${rp.name} (Lv.${rp.level}) がパーティーに合流しました！`, true);
            this.game.audio.playSe('chat');
            if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
          }
        } else {
          // Teleport immediately if area changed, otherwise smooth Lerp!
          if (rp.areaId !== msg.areaId) {
            rp.x = msg.x;
            rp.y = msg.y;
            rp.droneX = msg.droneX || msg.x;
            rp.droneY = msg.droneY || msg.y;
          }
          rp.name = msg.name || rp.name;
          rp.jobId = msg.jobId || rp.jobId;
          rp.level = msg.level || rp.level;
          rp.areaId = msg.areaId || rp.areaId;
          rp.targetX = msg.x;
          rp.targetY = msg.y;
          rp.targetFacing = msg.facing;
          rp.hp = msg.hp;
          rp.maxHp = msg.maxHp;
          rp.downed = Boolean(msg.downed);
          rp.downedTimer = msg.downedTimer ?? 30;
          rp.weaponColor = msg.weaponColor || rp.weaponColor;
          rp.weaponPlus = msg.weaponPlus || 0;
          rp.targetDroneX = msg.droneX || msg.x;
          rp.targetDroneY = msg.droneY || msg.y;
        }
        break;
      }
      case 'peer_left': {
        this.remotePlayers.delete(msg.peerId);
        this.game.addToast(`👋 ${msg.name || '仲間'} が退出しました`);
        if (this.onStatusChange) this.onStatusChange(this.getStatusInfo());
        break;
      }
      case 'chat': {
        const rp = this.remotePlayers.get(pid);
        const sender = msg.sender || (rp ? rp.name : '仲間');
        const text = String(msg.text || '').slice(0, 64);
        if (rp) rp.chatBubble = { text, timer: 4.5 };
        this.game.ui.addChatMessage(sender, text, false);
        this.game.audio.playSe(msg.isStamp ? 'stamp' : 'chat');
        break;
      }
      case 'vfx': {
        if (msg.areaId === this.game.currentAreaId) {
          this.game.playRemoteVfx(msg);
        }
        break;
      }
      case 'aoe_heal': {
        if (msg.areaId === this.game.currentAreaId) {
          const dist = Math.hypot(this.game.player.x - msg.x, this.game.player.y - msg.y);
          if (dist <= 300 && !this.game.player.downed) {
            const st = this.game.player.getStats();
            const healAmt = Math.round(msg.amount || st.maxHp * 0.4);
            this.game.player.hp = Math.min(st.maxHp, this.game.player.hp + healAmt);
            this.game.player.statuses.poison = 0;
            this.game.spawnDamageText(this.game.player.x, this.game.player.y - 26, `+${healAmt} HEAL!`, '#34d399', 1.2);
            this.game.spawnBurst(this.game.player.x, this.game.player.y, '#34d399', 14, 150);
            this.game.audio.playSe('heal');
          }
        }
        break;
      }
      case 'aoe_buff': {
        if (msg.areaId === this.game.currentAreaId) {
          const dist = Math.hypot(this.game.player.x - msg.x, this.game.player.y - msg.y);
          if (dist <= 320 && !this.game.player.downed) {
            this.game.player.statuses.overclock = Math.max(this.game.player.statuses.overclock, msg.duration || 12);
            this.game.spawnDamageText(this.game.player.x, this.game.player.y - 28, 'OVERCLOCK UP!', '#38f8d4', 1.15);
            this.game.spawnBurst(this.game.player.x, this.game.player.y, '#38f8d4', 14, 160);
            this.game.audio.playSe('buff');
          }
        }
        break;
      }
      case 'revive_done': {
        if (msg.targetId === this.peerId && this.game.player.downed) {
          this.game.reviveLocalPlayer(msg.rescuerName || '仲間');
        }
        break;
      }
      case 'shared_reward': {
        if (msg.areaId === this.game.currentAreaId) {
          this.game.receiveSharedPartyReward(msg);
        }
        break;
      }
      case 'boss_hit': {
        if (msg.areaId === this.game.currentAreaId && this.game.boss && this.game.boss.alive) {
          this.game.boss.takeDamage(msg.dmg, msg.element || 'none', Boolean(msg.isCrit), this.game);
        }
        break;
      }
      case 'world_event': {
        if (msg.areaId === this.game.currentAreaId) {
          this.game.applyRemoteWorldEvent(msg);
        }
        break;
      }
      default:
        break;
    }
  }

  sendChat(text, isStamp = false) {
    const clean = String(text || '').trim().slice(0, 60);
    if (!clean) return;
    this.game.player.setChatBubble(clean);
    this.game.ui.addChatMessage(this.game.player.name, clean, false);
    this.game.audio.playSe(isStamp ? 'stamp' : 'chat');
    if (this.isMultiplayer()) {
      this.broadcast({
        type: 'chat',
        sender: this.game.player.name,
        text: clean,
        isStamp,
      });
    }
  }

  update(dt) {
    // Smooth Lerp Interpolation for all Remote Players (silky 60fps!)
    const factor = Math.min(1, dt * 12);
    for (const rp of this.remotePlayers.values()) {
      rp.x += (rp.targetX - rp.x) * factor;
      rp.y += (rp.targetY - rp.y) * factor;
      rp.droneX += (rp.targetDroneX - rp.droneX) * factor;
      rp.droneY += (rp.targetDroneY - rp.droneY) * factor;
      // Shortest angular interpolation
      let dAng = rp.targetFacing - rp.facing;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      rp.facing += dAng * factor;

      if (rp.chatBubble) {
        rp.chatBubble.timer -= dt;
        if (rp.chatBubble.timer <= 0) rp.chatBubble = null;
      }
    }

    // 20Hz Local Player State Broadcast
    if (this.isMultiplayer()) {
      this.syncTimer += dt;
      if (this.syncTimer >= 0.05) {
        this.syncTimer = 0;
        this.broadcast(this._buildLocalStatePacket('state'));
      }
    }
  }
}
