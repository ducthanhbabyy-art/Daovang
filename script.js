const firebaseConfig = {
    apiKey: "AIzaSyA0aFwr-k_HTF7xtHD6CV59-NlgFMm8x0w",
    authDomain: "thanhdaovang-d33eb.firebaseapp.com",
    projectId: "thanhdaovang-d33eb",
    storageBucket: "thanhdaovang-d33eb.firebasestorage.app",
    messagingSenderId: "1065876789519",
    appId: "1:1065876789519:web:d75993c0c97f0b8af9c67a",
    databaseURL: "https://thanhdaovang-d33eb-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;
const ADMIN_ID = 6318057690;
const user = tg.initDataUnsafe?.user || { id: ADMIN_ID, first_name: "User" };

let userData = { balance: 0, speed: 0, last: Date.now(), usedCodes: {} };

const workers = [
    {n:'Phu đào', p:10}, {n:'Thợ sắt', p:50}, {n:'Chuyên gia', p:100}, {n:'Robot', p:500}
];

function init() {
    tg.expand();
    if (user.id == ADMIN_ID) document.getElementById('btn-admin').classList.remove('hidden');

    // RENDER CÔNG NHÂN
    const grid = document.getElementById('tab-mine');
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.5; // Lãi 50%/ngày
        grid.innerHTML += `
            <div class="bg-white/10 rounded-3xl p-4 text-center border border-white/20 shadow-lg">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n}</p>
                <div class="my-2 text-3xl">👷</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-black active:bg-yellow-500">${w.p.toLocaleString()} 💰</button>
            </div>`;
    });

    // LẤY DỮ LIỆU
    db.ref('users/' + user.id).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            let now = Date.now();
            let elapsedSec = (now - (data.last || now)) / 1000;
            userData = data;
            userData.balance += elapsedSec * ((data.speed || 0) / 86400);
            userData.last = now;
        } else {
            save();
        }
        render();
    });
}

// MUA CÔNG NHÂN
function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed = (userData.speed || 0) + s;
        save();
        tg.showAlert("Đã thuê công nhân!");
    } else tg.showAlert("Bạn không đủ vàng!");
}

// RÚT TIỀN (500 vàng = 5000đ)
function updateVnd(v) { document.getElementById('vnd-preview').innerText = (v * 10).toLocaleString(); }
function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (!gold || gold < 500) return tg.showAlert("Tối thiểu 500 vàng!");
    if (gold > userData.balance) return tg.showAlert("Không đủ số dư!");
    if (!info) return tg.showAlert("Nhập thông tin nhận tiền!");

    userData.balance -= gold;
    db.ref('withdraws').push({ uid: user.id, gold: gold, info: info, status: "Pending", time: Date.now() });
    save();
    tg.showAlert("Đã gửi yêu cầu rút!");
}

// GIFTCODE
function redeemGiftcode() {
    const code = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if (!code) return;
    if (userData.usedCodes && userData.usedCodes[code]) return tg.showAlert("Mã này bạn dùng rồi!");

    db.ref('giftcodes/' + code).get().then(s => {
        if (s.exists()) {
            const c = s.val();
            if (c.count >= c.limit) return tg.showAlert("Mã đã hết lượt!");
            userData.balance += c.reward;
            if (!userData.usedCodes) userData.usedCodes = {};
            userData.usedCodes[code] = true;
            db.ref('giftcodes/' + code + '/count').transaction(n => (n || 0) + 1);
            save();
            tg.showAlert(`Nhận thành công ${c.reward} vàng!`);
            document.getElementById('giftcode-input').value = "";
        } else tg.showAlert("Mã không tồn tại!");
    });
}

// ADMIN FUNCTIONS
function createGiftcode() {
    const name = document.getElementById('admin-code-name').value.trim().toUpperCase();
    const rew = parseInt(document.getElementById('admin-code-reward').value);
    const lim = parseInt(document.getElementById('admin-code-limit').value);
    if (!name || isNaN(rew)) return;
    db.ref('giftcodes/' + name).set({ reward: rew, limit: lim, count: 0 });
    tg.showAlert("Đã tạo code: " + name);
}

function adminAdjust(isAdd) {
    const uid = document.getElementById('admin-uid').value.trim();
    const amt = parseFloat(document.getElementById('admin-amount').value);
    if (!uid || isNaN(amt)) return;
    db.ref('users/' + uid + '/balance').transaction(b => isAdd ? (b || 0) + amt : (b || 0) - amt);
    tg.showAlert("Đã thực hiện!");
}

function loadWithdraws() {
    db.ref('withdraws').on('value', s => {
        const list = document.getElementById('admin-withdraw-list');
        list.innerHTML = "";
        s.forEach(item => {
            const d = item.val();
            if (d.status === "Pending") {
                list.innerHTML += `<div class="bg-black/40 p-3 rounded-xl text-[10px] mb-2 border border-white/5">
                    UID: ${d.uid} | Vàng: ${d.gold} (${d.gold * 10}đ)<br>
                    <span class="text-yellow-400">${d.info}</span>
                    <div class="flex gap-2 mt-2">
                        <button onclick="approve('${item.key}',true)" class="bg-green-600 px-3 py-1 rounded">DUYỆT</button>
                        <button onclick="approve('${item.key}',false,'${d.uid}',${d.gold})" class="bg-red-600 px-3 py-1 rounded">HỦY</button>
                    </div>
                </div>`;
            }
        });
    });
}

function approve(key, isOk, uid, gold) {
    if (isOk) db.ref('withdraws/' + key).update({ status: "Done" });
    else {
        db.ref('users/' + uid + '/balance').transaction(b => (b || 0) + gold);
        db.ref('withdraws/' + key).update({ status: "Cancel" });
    }
}

// SYSTEM
function render() {
    document.getElementById('balance').innerText = userData.balance.toLocaleString(undefined, {
        minimumFractionDigits: 3, maximumFractionDigits: 3
    });
    document.getElementById('rate').innerText = ((userData.speed || 0) / 24).toFixed(2);
}
function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }
function nav(t) {
    ['mine','task','draw','admin'].forEach(id => {
        document.getElementById('tab-'+id)?.classList.add('hidden');
        document.getElementById('btn-'+id)?.classList.remove('active-tab');
    });
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('btn-'+t).classList.add('active-tab');
    if (t === 'admin') loadWithdraws();
}

setInterval(() => { if (userData.speed > 0) { userData.balance += (userData.speed / 86400) / 10; render(); } }, 100);
init();
