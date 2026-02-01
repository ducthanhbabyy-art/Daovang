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
const user = tg.initDataUnsafe?.user || { id: 6318057690, first_name: "Admin" };

let userData = { balance: 500, speed: 0, last: Date.now(), tasks: {} };
const workers = [
    {n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:30}, {n:'Killer', p:40},
    {n:'Pugilist', p:50}, {n:'Romeo', p:75}, {n:'Shooter', p:100}, {n:'Warrior', p:150},
    {n:'Casanova', p:200}, {n:'Chieftain', p:250}, {n:'Detector', p:500}, {n:'Beast', p:1000}
];

function init() {
    tg.expand();
    render();
    if (user.id == 6318057690) document.getElementById('btn-admin').classList.remove('hidden');
    document.getElementById('ref-url').value = "https://t.me/thanhdaovang_bot/app?startapp=" + user.id;

    const grid = document.getElementById('tab-mine');
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.5;
        grid.innerHTML += `
            <div class="bg-white/10 rounded-3xl p-4 text-center border border-white/20 shadow-lg">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n} 50%</p>
                <div class="my-2 text-3xl">👤</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-black border border-white/30 active:scale-95 transition">${w.p} 💰</button>
            </div>`;
    });

    db.ref('users/' + user.id).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            let now = Date.now();
            let elapsedSec = (now - data.last) / 1000;
            userData = data;
            userData.balance += elapsedSec * (data.speed / 86400);
            userData.last = now;
        } else {
            const startParam = tg.initDataUnsafe.start_param;
            if (startParam && startParam != user.id) {
                db.ref('users/' + startParam + '/balance').transaction(b => (b || 0) + 200);
                userData.refBy = startParam;
            }
            save();
        }
        render();
        checkTasks();
    });
}

// --- LOGIC NGƯỜI CHƠI ---
function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed += s;
        if (userData.refBy) db.ref('users/' + userData.refBy + '/balance').transaction(b => (b || 0) + (p * 0.1));
        save();
        tg.HapticFeedback.impactOccurred('medium');
    } else tg.showAlert("Bạn không đủ vàng!");
}

function redeemCode() {
    const code = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if (!code) return;
    db.ref('giftcodes/' + code).once('value', s => {
        const c = s.val();
        if (s.exists() && c.limit > 0 && (!c.users || !c.users[user.id])) {
            userData.balance += c.amount;
            db.ref('giftcodes/' + code + '/limit').transaction(l => l - 1);
            db.ref('giftcodes/' + code + '/users/' + user.id).set(true);
            save();
            tg.showAlert("Thành công! Nhận " + c.amount + " vàng");
            document.getElementById('giftcode-input').value = "";
        } else {
            tg.showAlert("Mã sai, hết lượt hoặc bạn đã sử dụng rồi!");
        }
    });
}

function updateVnd(v) { 
    // Tỉ lệ: 10,000 Vàng = 5,000 VND => 1 Vàng = 0.5 VND
    document.getElementById('vnd-preview').innerText = (v * 0.5).toLocaleString(); 
}

function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (gold > userData.balance || gold < 1 || !info) return tg.showAlert("Thông tin không hợp lệ!");
    userData.balance -= gold;
    db.ref('withdraws').push({ uid: user.id, gold: gold, info: info, status: "Pending", time: Date.now() });
    save();
    tg.showAlert("Đã gửi yêu cầu rút tiền thành công!");
}

// --- LOGIC ADMIN ---
function createGiftcode() {
    const code = document.getElementById('admin-code').value.trim().toUpperCase();
    const amount = parseFloat(document.getElementById('admin-code-val').value);
    const limit = parseInt(document.getElementById('admin-code-limit').value);
    if (!code || isNaN(amount)) return tg.showAlert("Thiếu thông tin!");
    db.ref('giftcodes/' + code).set({ amount, limit });
    tg.showAlert("Đã tạo Giftcode: " + code);
}

function adminAdjust(isAdd) {
    const uid = document.getElementById('admin-uid').value.trim();
    const amount = parseFloat(document.getElementById('admin-amount').value);
    if (!uid || isNaN(amount)) return;
    db.ref('users/' + uid + '/balance').transaction(b => isAdd ? (b || 0) + amount : (current) => (current || 0) - amount);
    tg.showAlert("Đã cập nhật số dư UID: " + uid);
}

function loadWithdraws() {
    db.ref('withdraws').on('value', s => {
        const list = document.getElementById('admin-withdraw-list');
        list.innerHTML = "";
        if (!s.exists()) list.innerHTML = "<p class='text-[10px] text-center opacity-50'>Không có yêu cầu nào</p>";
        s.forEach(item => {
            const d = item.val();
            if (d.status === "Pending") {
                list.innerHTML += `<div class="bg-black/40 p-3 rounded-xl text-[10px] border border-white/5 shadow-inner">
                    UID: ${d.uid} | Vàng: ${d.gold} (${(d.gold * 0.5).toLocaleString()}đ)<br>
                    <span class="text-yellow-500">${d.info}</span>
                    <div class="flex gap-2 mt-2">
                        <button onclick="approve('${item.key}',true)" class="bg-green-600 px-3 py-1 rounded font-bold">DUYỆT</button>
                        <button onclick="approve('${item.key}',false,'${d.uid}',${d.gold})" class="bg-red-600 px-3 py-1 rounded font-bold">HỦY</button>
                    </div>
                </div>`;
            }
        });
    });
}

function approve(key, isDone, uid, gold) {
    if (isDone) {
        db.ref('withdraws/' + key).update({ status: "Completed" });
        tg.showAlert("Đã DUYỆT yêu cầu!");
    } else {
        db.ref('users/' + uid + '/balance').transaction(b => (b || 0) + gold);
        db.ref('withdraws/' + key).update({ status: "Cancelled" });
        tg.showAlert("Đã HỦY và trả lại vàng cho người chơi!");
    }
}

// --- HỆ THỐNG ---
function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }
function render() {
    document.getElementById('balance').innerText = userData.balance.toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('rate').innerText = (userData.speed / 24).toFixed(2);
}
function nav(t) {
    ['mine','task','ref','draw','admin'].forEach(id => {
        if(document.getElementById('tab-'+id)) document.getElementById('tab-'+id).classList.add('hidden');
        if(document.getElementById('btn-'+id)) document.getElementById('btn-'+id).classList.remove('active-tab');
    });
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('btn-'+t).classList.add('active-tab');
    if (t === 'admin') loadWithdraws();
}
function copyLink() {
    const url = document.getElementById("ref-url");
    url.select();
    navigator.clipboard.writeText(url.value);
    tg.showAlert("Đã sao chép liên kết giới thiệu!");
}
function doTask(chan, reward, id) {
    if (userData.tasks && userData.tasks[id]) return;
    tg.openTelegramLink("https://t.me/" + chan.replace('@', ''));
    tg.showConfirm("Bạn đã tham gia chưa?", (ok) => {
        if (ok) {
            userData.balance += reward;
            if(!userData.tasks) userData.tasks = {};
            userData.tasks[id] = true;
            save();
            tg.showAlert("Nhận thưởng thành công!");
        }
    });
}
function checkTasks() {
    [1, 2].forEach(id => {
        if (userData.tasks && userData.tasks[id]) {
            const b = document.getElementById('task-' + id);
            if(b) { b.innerText = "XONG"; b.disabled = true; b.classList.replace('bg-blue-500', 'bg-gray-500'); }
        }
    });
}
setInterval(() => { if (userData.speed > 0) { userData.balance += (userData.speed / 86400); render(); } }, 1000);
setInterval(save, 30000);
init();
