const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusDiv = document.getElementById("status");

// ゲームの設定
const gravity = 0.5;
const friction = 0.8;
const jumpStrength = -12;
const moveSpeed = 5;

// プレイヤーの設定
const player = {
    x: 50,
    y: 200,
    width: 30,
    height: 60,
    color: "red",
    vx: 0,
    vy: 0,
    grounded: false,
    isBig: true,
    invincible: 0
};

// 敵キャラの設定
const enemies = [
    { x: 300, y: 320, w: 30, h: 30, color: "blue", vx: 2, startX: 300, range: 100, timer: 0 },
    { x: 500, y: 170, w: 30, h: 30, color: "blue", vx: -2, startX: 500, range: 80, timer: 0 }
];

let hammers = [];
let gameWon = false; // ゴールしたかどうかのフラグ

// 足場の設定
const platforms = [
    { x: 0, y: 350, w: 800, h: 50 },  // 地面
    { x: 200, y: 250, w: 100, h: 20 },
    { x: 400, y: 200, w: 100, h: 20, vx: 2, startX: 400, range: 100 }, // 動く床
    { x: 600, y: 150, w: 100, h: 20 }
];

// はてなブロックの設定
const blocks = [
    { x: 150, y: 200, w: 30, h: 30, active: true },
    { x: 450, y: 100, w: 30, h: 30, active: true },
    { x: 350, y: 200, w: 30, h: 30, active: true }
];

let items = [];

const goal = { x: 700, y: 100, w: 30, h: 30, color: "gold" };

const keys = {
    right: false,
    left: false,
    up: false
};

document.addEventListener("keydown", function (e) {
    if (e.code === "ArrowRight") keys.right = true;
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "Space") keys.up = true;
});

document.addEventListener("keyup", function (e) {
    if (e.code === "ArrowRight") keys.right = false;
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "Space") keys.up = false;
});

function update() {
    // もしゴールしていたら、更新（ゲーム進行）は止めるが描画は続ける
    if (gameWon) {
        draw();
        requestAnimationFrame(update);
        return;
    }

    // --- プレイヤーの動き ---
    if (keys.right) {
        player.vx = moveSpeed;
    } else if (keys.left) {
        player.vx = -moveSpeed;
    } else {
        player.vx *= friction;
    }

    if (keys.up && player.grounded) {
        player.vy = jumpStrength;
        player.grounded = false;
    }

    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;

    if (player.invincible > 0) player.invincible--;

    // --- 足場との当たり判定 ---
    player.grounded = false;
    for (const p of platforms) {
        if (p.vx) {
            p.x += p.vx;
            if (p.x > p.startX + p.range || p.x < p.startX - p.range) p.vx *= -1;
        }

        if (checkCollision(player, p)) {
            if (player.vy >= 0 && (player.y + player.height - player.vy) <= p.y + 10) {
                player.grounded = true;
                player.vy = 0;
                player.y = p.y - player.height;
                if (p.vx) player.x += p.vx;
            } else if (player.vy < 0 && player.y - player.vy >= p.y + p.h) {
                player.vy = 0;
                player.y = p.y + p.h;
            }
        }
    }

    // --- はてなブロックとの当たり判定 ---
    for (const b of blocks) {
        if (checkCollision(player, b)) {
            if (player.vy >= 0 && (player.y + player.height - player.vy) <= b.y + 10) {
                player.grounded = true;
                player.vy = 0;
                player.y = b.y - player.height;
            }
            else if (player.vy < 0 && player.y - player.vy >= b.y + b.h - 10) {
                player.vy = 0;
                player.y = b.y + b.h;

                if (b.active) {
                    b.active = false;
                    spawnMushroom(b.x, b.y);
                    statusDiv.innerText = "キノコが出た！";
                    statusDiv.style.color = "orange";
                }
            }
        }
    }

    // --- アイテム（キノコ）の動き ---
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.vy += gravity;
        item.x += item.vx;
        item.y += item.vy;

        for (const p of platforms) {
            if (checkCollision(item, p)) {
                if (item.vy >= 0) {
                    item.vy = 0;
                    item.y = p.y - item.h;
                }
            }
        }
        for (const b of blocks) {
            if (checkCollision(item, b)) {
                if (item.vy >= 0) {
                    item.vy = 0;
                    item.y = b.y - item.h;
                }
            }
        }

        if (checkCollision(player, item)) {
            player.isBig = true;
            player.height = 60;
            player.y -= 30;
            items.splice(i, 1);
            statusDiv.innerText = "大きくなった！";
            statusDiv.style.color = "#ffeb3b";
        }
    }

    // --- 敵の動き ---
    for (const enemy of enemies) {
        enemy.x += enemy.vx;
        if (enemy.x > enemy.startX + enemy.range || enemy.x < enemy.startX - enemy.range) enemy.vx *= -1;

        if (checkCollision(player, enemy)) takeDamage("敵に当たった！");

        enemy.timer++;
        if (enemy.timer > 100) {
            const direction = (player.x < enemy.x) ? -1 : 1;
            hammers.push({ x: enemy.x, y: enemy.y, w: 10, h: 10, vx: 3 * direction, vy: -8, color: "orange" });
            enemy.timer = 0;
        }
    }

    // --- ハンマー ---
    for (let i = hammers.length - 1; i >= 0; i--) {
        const h = hammers[i];
        h.vy += gravity;
        h.x += h.vx;
        h.y += h.vy;

        if (checkCollision(player, h)) takeDamage("ハンマーに当たった！");
        if (h.y > canvas.height || h.x < 0 || h.x > canvas.width) hammers.splice(i, 1);
    }

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    if (player.y > canvas.height) resetGame("落ちちゃった！");

    // --- ゴール判定 ---
    if (checkCollision(player, goal)) {
        gameWon = true; // ゴールフラグを立てる
        statusDiv.innerText = "ゴール！！おめでとう！！🎉";
        statusDiv.style.color = "#ffeb3b";
    }

    draw();
    requestAnimationFrame(update);
}

function spawnMushroom(bx, by) {
    items.push({
        x: bx, y: by - 30, w: 30, h: 30, vx: 2, vy: -5,
        type: 'mushroom', color: 'red'
    });
}

function takeDamage(msg) {
    if (player.invincible > 0) return;

    if (player.isBig) {
        player.isBig = false;
        player.height = 30;
        player.y += 30;
        player.invincible = 60;
        statusDiv.innerText = msg + " 小さくなっちゃった！";
        statusDiv.style.color = "orange";
    } else {
        resetGame(msg);
    }
}

function resetGame(message) {
    player.x = 50;
    player.y = 200;
    player.vy = 0;
    player.isBig = true;
    player.width = 30;
    player.height = 60;
    player.invincible = 0;
    gameWon = false; // フラグもリセット

    hammers = [];
    items = [];
    blocks.forEach(b => b.active = true);

    statusDiv.innerText = message + "やり直し！";
    statusDiv.style.color = "red";
}

function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + (rect2.w || rect2.width) &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + (rect2.h || rect2.height) &&
        rect1.y + rect1.height > rect2.y);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ゴールしている場合は背景を変える
    if (gameWon) {
        // 背景を金色に
        ctx.fillStyle = "rgba(255, 215, 0, 0.8)"; // 半透明のゴールド
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // GOALの文字
        ctx.fillStyle = "white";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GOAL!!", canvas.width / 2, canvas.height / 2);

        ctx.font = "20px Arial";
        ctx.fillStyle = "#333";
        ctx.fillText("Congratulations!", canvas.width / 2, canvas.height / 2 + 50);

        // ※背景が描画された後にキャラクターたちを描くか、
        // あるいはキャラクターたちの後ろに背景を描くか選べますが、
        // 今回は「お祝い画面」として上から被せました。
        // もしキャラも見せたいなら、fillRectのこの処理を一番最初に書けばOKです。
        // ここでは「GOAL演出」を目立たせるために一番最後に書きました（キャラは見えなくなります）。
        return;
    }

    // 足場
    for (const p of platforms) {
        if (p.vx) ctx.fillStyle = "#aed581";
        else ctx.fillStyle = "#66bb6a";
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // ブロック
    for (const b of blocks) {
        if (b.active) ctx.fillStyle = "#fdd835";
        else ctx.fillStyle = "#795548";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = "#444";
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (b.active) {
            ctx.fillStyle = "#000";
            ctx.font = "20px Arial";
            ctx.textAlign = "left"; // デフォルトに戻す
            ctx.fillText("?", b.x + 8, b.y + 22);
        }
    }

    // アイテム
    for (const item of items) {
        ctx.fillStyle = "#e53935";
        ctx.fillRect(item.x, item.y, item.w, item.h);
    }

    ctx.fillStyle = "blue";
    for (const enemy of enemies) ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);

    ctx.fillStyle = "orange";
    for (const h of hammers) ctx.fillRect(h.x, h.y, h.w, h.h);

    ctx.fillStyle = goal.color;
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);

    if (player.invincible > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
    } else {
        if (!player.isBig) ctx.fillStyle = "#ff8a80";
        else ctx.fillStyle = "red";
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
}

update();
