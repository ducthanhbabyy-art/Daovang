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

let userData = { balance: 0, speed: 0, last: Date.now(), tasks: {}, usedCodes: {} };

const workers = [
    {n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:30}, {n:'Killer', p:40},
    {n:'Pugilist', p:50}, {n:'Romeo', p:75}, {n:'Shooter', p:100}, {n:'Warrior', p:150},
    {n:'Casanova', p:200}, {n:'Chieftain', p:250}, {n:'Detector', p:500}, {n:'Beast', p:1000}
];

function init() {
    tg.expand();
    if (user.id == ADMIN_ID) document.getElementById('btn-admin').classList.remove('hidden');

    const grid = document.getElementById('tab-mine');
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.5;
        grid.innerHTML += `
            <div class="bg-white/10 rounded-3xl p-4 text-center border border-white/20">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n}</p>
                <div class="my-2 text-3xl">👷</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-black">${w.p.toLocaleString()} 💰</button>
            </div>`;
    });

    db.ref('users/' + user.id).on('value', (s) => {
        if (s.exists()) {
            const data = s.val();
            let now = Date.now();
            let elapsed = (now - (data.last || now)) / 1000;
            userData = data;
            userData.balance += elapsed * ((data.speed || 0) / 86400);
            userData.last = now;
        } else save();
        render();
        checkTasks();
    });
}

function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed = (userData.speed || 0) + s;
        save();
        tg.showAlert("Đã thuê thợ đào!");
    } else tg.showAlert("Bạn không đủ vàng!");
}

// Tỉ lệ: 1000 vàng = 5000đ -> 1 vàng = 5đ
function updateVnd(v) { document.getElementById('vnd-preview').innerText = (v * 5).toLocaleString(); }

function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (!gold || gold < 1000) return tg.showAlert("Rút tối thiểu 1.000 vàng!");
    if (gold > userData.balance) return tg.showAlert("Không đủ số dư!");
    if (!info) return tg.showAlert("Vui lòng điền thông tin!");

    userData.balance -= gold;
    db.ref('withdraws').push({ 
        uid: user.id, gold, info, status: "Pending", time: Date.now() 
    });
    save();
    tg.showAlert("Đã gửi yêu cầu rút tiền!");
    loadUserHistory();
}

// Lịch sử rút tiền cho người dùng
function loadUserHistory() {
    db.ref('withdraws').orderByChild('uid').equalTo(user.id).on('value', s => {
        const div = document.getElementById('user-history');
        div.innerHTML = "";
        if (!s.exists()) div.innerHTML = "<p class='text-[10px] text-center opacity-50'>Chưa có lịch sử</p>";
        let items = [];
        s.forEach(child => { items.unshift(child.val()); });
        items.forEach(d => {
            let statusColor = d.status === "Done" ? "text-green-400" : (d.status === "Cancel" ? "text-red-400" : "text-yellow-400");
            let statusText = d.status === "Done" ? "Thành công" : (d.status === "Cancel" ? "Đã hủy" : "Chờ duyệt");
            div.innerHTML += `
                <div class="bg-black/30 p-2 rounded-xl text-[9px] border border-white/5 flex justify-between">
                    <span>${d.gold}💰 (${d.gold * 5}đ)</span>
                    <span class="${statusColor}">${statusText}</span>
                </div>`;
        });
    });
}

function redeemGiftcode() {
    const code = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if (!code) return;
    if (userData.usedCodes?.[code]) return tg.showAlert("Bạn đã dùng mã này!");
    db.ref('giftcodes/' + code).get().then(s => {
        if (s.exists()) {
            const c = s.val();
            if (c.count >= c.limit) return tg.showAlert("Mã đã hết lượt!");
            userData.balance += c.reward;
            if(!userData.usedCodes) userData.usedCodes = {};
            userData.usedCodes[code] = true;
            db.ref('giftcodes/' + code + '/count').transaction(n => (n || 0) + 1);
            save();
            tg.showAlert("Nhận thành công!");
            document.getElementById('giftcode-input').value = "";
        } else tg.showAlert("Mã không đúng!");
    });
}

// ADMIN
function createGiftcode() {
    const name = document.getElementById('admin-code-name').value.trim().toUpperCase();
    const rew = parseInt(document.getElementById('admin-code-reward').value);
    const lim = parseInt(document.getElementById('admin-code-limit').value);
    if (!name || isNaN(rew)) return;
    db.ref('giftcodes/' + name).set({ reward: rew, limit: lim, count: 0 });
    tg.showAlert("Đã tạo code!");
}

function adminAdjust(isAdd) {
    const uid = document.getElementById('admin-uid').value.trim();
    const amt = parseFloat(document.getElementById('admin-amount').value);
    if (!uid || isNaN(amt)) return;
    db.ref('users/' + uid + '/balance').transaction(b => isAdd ? (b || 0) + amt : (b || 0) - amt);
    tg.showAlert("Xong!");
}

function loadWithdraws() {
    db.ref('withdraws').on('value', s => {
        const list = document.getElementById('admin-withdraw-list');
        list.innerHTML = "";
        s.forEach(item => {
            const d = item.val();
            if (d.status === "Pending") {
                list.innerHTML += `<div class="bg-black/40 p-2 rounded-xl text-[10px] mb-2 border border-white/5">
                    UID: ${d.uid} | ${d.gold}💰 (${d.gold*5}đ)<br>${d.info}<br>
                    <button onclick="approve('${item.key}',true)" class="bg-green-600 px-2 py-1 rounded mt-1">Duyệt</button>
                    <button onclick="approve('${item.key}',false,'${d.uid}',${d.gold})" class="bg-red-600 px-2 py-1 rounded mt-1">Hủy</button>
                </div>`;
            }
        });
    });
}

function approve(key, ok, uid, g) {
    if (ok) db.ref('withdraws/' + key).update({ status: "Done" });
    else {
        db.ref('users/' + uid + '/balance').transaction(b => (b || 0) + g);
        db.ref('withdraws/' + key).update({ status: "Cancel" });
    }
}

function doTask(chan, reward, id) {
    if (userData.tasks?.[id]) return;
    tg.openTelegramLink("https://t.me/" + chan.replace('@', ''));
    tg.showConfirm("Đã tham gia chưa?", ok => {
        if (ok) {
            userData.balance += reward;
            if(!userData.tasks) userData.tasks = {};
            userData.tasks[id] = true;
            save();
            checkTasks();
        }
    });
}

function checkTasks() {
    [1, 2].forEach(id => {
        if (userData.tasks?.[id]) {
            const b = document.getElementById('task-' + id);
            if(b) { b.innerText = "XONG"; b.disabled = true; b.classList.replace('bg-blue-500', 'bg-gray-500'); }
        }
    });
}

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
    if (t === 'draw') loadUserHistory();
    if (t === 'admin') loadWithdraws();
}

setInterval(() => { if (userData.speed > 0) { userData.balance += (userData.speed / 86400) / 10; render(); } }, 100);
init();
