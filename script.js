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
// ID CỦA BẠN ĐỂ HIỆN TAB ADMIN
const ADMIN_ID = 6318057690;
const user = tg.initDataUnsafe?.user || { id: ADMIN_ID, first_name: "Admin" };

let userData = { balance: 500, speed: 0, last: Date.now(), tasks: {} };

const workers = [
    {n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:30}, {n:'Killer', p:40},
    {n:'Pugilist', p:50}, {n:'Romeo', p:75}, {n:'Shooter', p:100}, {n:'Warrior', p:150},
    {n:'Casanova', p:200}, {n:'Chieftain', p:250}, {n:'Detector', p:500}, {n:'Beast', p:1000}
];

function init() {
    tg.expand();
    render();
    if (user.id == ADMIN_ID) document.getElementById('btn-admin').classList.remove('hidden');
    document.getElementById('ref-url').value = "https://t.me/thanhdaovang_bot/app?startapp=" + user.id;

    const grid = document.getElementById('tab-mine');
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.5;
        grid.innerHTML += `
            <div class="bg-white/10 rounded-3xl p-4 text-center border border-white/20">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n}</p>
                <div class="my-2 text-3xl">👤</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily.toLocaleString()} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-black border border-white/30 active:scale-95 transition">${w.p.toLocaleString()} 💰</button>
            </div>`;
    });

    db.ref('users/' + user.id).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            let now = Date.now();
            let elapsedSec = (now - (data.last || now)) / 1000;
            userData = data;
            userData.balance += elapsedSec * ((data.speed || 0) / 86400);
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

function buy(price, speedGain) {
    if (userData.balance >= price) {
        userData.balance -= price;
        userData.speed = (userData.speed || 0) + speedGain;
        if (userData.refBy) db.ref('users/' + userData.refBy + '/balance').transaction(b => (b || 0) + (price * 0.1));
        save();
        tg.HapticFeedback.impactOccurred('medium');
        tg.showAlert("Thành công!");
    } else tg.showAlert("Bạn không đủ vàng!");
}

function updateVnd(v) { 
    // Tỉ lệ 2.000 vàng = 5.000 VND => 1 vàng = 2.5 VND
    document.getElementById('vnd-preview').innerText = (v * 2.5).toLocaleString(); 
}

function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (!gold || gold < 2000) return tg.showAlert("Tối thiểu 2.000 vàng!");
    if (gold > userData.balance) return tg.showAlert("Không đủ vàng!");
    if (!info) return tg.showAlert("Thiếu thông tin nhận tiền!");
    
    userData.balance -= gold;
    db.ref('withdraws').push({ uid: user.id, gold: gold, info: info, status: "Pending", time: Date.now() });
    save();
    tg.showAlert("Đã gửi yêu cầu rút!");
}

function render() {
    if(!userData) return;
    document.getElementById('balance').innerText = userData.balance.toLocaleString(undefined, {
        minimumFractionDigits: 3, maximumFractionDigits: 3
    });
    document.getElementById('rate').innerText = ((userData.speed || 0) / 24).toFixed(2);
}

// --- HÀM ADMIN ---
function loadWithdraws() {
    db.ref('withdraws').on('value', s => {
        const list = document.getElementById('admin-withdraw-list');
        list.innerHTML = "";
        if (!s.exists()) list.innerHTML = "<p class='text-[10px] text-center opacity-50'>Không có yêu cầu nào</p>";
        s.forEach(item => {
            const d = item.val();
            if (d.status === "Pending") {
                list.innerHTML += `<div class="bg-black/40 p-3 rounded-xl text-[10px] border border-white/5">
                    UID: ${d.uid} | Vàng: ${d.gold.toLocaleString()} (${(d.gold * 2.5).toLocaleString()}đ)<br>
                    <span class="text-yellow-500 font-bold">${d.info}</span>
                    <div class="flex gap-2 mt-2">
                        <button onclick="approve('${item.key}',true)" class="bg-green-600 px-3 py-1 rounded font-black">DUYỆT</button>
                        <button onclick="approve('${item.key}',false,'${d.uid}',${d.gold})" class="bg-red-600 px-3 py-1 rounded font-black">HỦY</button>
                    </div>
                </div>`;
            }
        });
    });
}

function approve(key, isDone, uid, gold) {
    if (isDone) {
        db.ref('withdraws/' + key).update({ status: "Completed" });
        tg.showAlert("Đã duyệt lệnh!");
    } else {
        db.ref('users/' + uid + '/balance').transaction(b => (b || 0) + gold);
        db.ref('withdraws/' + key).update({ status: "Cancelled" });
        tg.showAlert("Đã hủy và trả vàng cho người dùng!");
    }
}

function adminAdjust(isAdd) {
    const uid = document.getElementById('admin-uid').value.trim();
    const amount = parseFloat(document.getElementById('admin-amount').value);
    if (!uid || isNaN(amount)) return tg.showAlert("Vui lòng nhập UID và số vàng");
    db.ref('users/' + uid + '/balance').transaction(b => isAdd ? (b || 0) + amount : (b || 0) - amount);
    tg.showAlert("Đã thực hiện!");
}

function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }

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
    tg.showAlert("Đã copy link mời!");
}

function doTask(chan, reward, id) {
    if (userData.tasks && userData.tasks[id]) return;
    tg.openTelegramLink("https://t.me/" + chan.replace('@', ''));
    tg.showConfirm("Xác nhận tham gia?", (ok) => {
        if (ok) {
            userData.balance += reward;
            if(!userData.tasks) userData.tasks = {};
            userData.tasks[id] = true;
            save();
            tg.showAlert("Thành công!");
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

setInterval(() => { 
    if (userData && userData.speed > 0) { 
        let gainPerTick = (userData.speed / 86400) / 10;
        userData.balance += gainPerTick; 
        render(); 
    } 
}, 100);

setInterval(save, 20000);
init();
