// --- CẤU HÌNH FIREBASE CỦA BẠN ---
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
const user = tg.initDataUnsafe?.user || { id: 6318057690, first_name: "Thanh" };
const ADMIN_ID = 6318057690;

let userData = { balance: 500, speed: 0, last: Date.now(), refBy: null };
const workers = [
    {n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:30}, {n:'Killer', p:40},
    {n:'Pugilist', p:50}, {n:'Romeo', p:75}, {n:'Shooter', p:100}, {n:'Warrior', p:150},
    {n:'Casanova', p:200}, {n:'Chieftain', p:250}, {n:'Detector', p:500}, {n:'Beast', p:1000}
];

function init() {
    tg.expand();
    if (user.id === ADMIN_ID) document.getElementById('adm-box').classList.remove('hidden');
    document.getElementById('ref-url').value = `https://t.me/GomXu_Bot/app?startapp=${user.id}`;

    // Render workers
    const grid = document.getElementById('tab-mine');
    workers.forEach((w, i) => {
        let daily = w.p * 0.5;
        grid.innerHTML += `
            <div class="bg-white/10 backdrop-blur-md rounded-3xl p-4 text-center border border-white/20 shadow-xl">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n}</p>
                <div class="my-2 text-3xl">👤</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 hover:bg-white/30 py-2 rounded-xl text-xs transition active:scale-90 font-bold border border-white/30">${w.p} 💰</button>
            </div>`;
    });

    // Load data
    db.ref('users/' + user.id).once('value', (s) => {
        if (s.exists()) {
            userData = s.val();
            let offline = (Date.now() - userData.last) / 1000 * (userData.speed / 86400);
            userData.balance += offline;
        } else {
            userData.refBy = tg.initDataUnsafe.start_param || null;
            if (userData.refBy) db.ref('users/' + userData.refBy + '/balance').transaction(b => (b || 0) + 200);
            db.ref('users/' + user.id).set(userData);
        }
        render();
    });
}

function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed += s;
        if (userData.refBy) db.ref('users/' + userData.refBy + '/balance').transaction(b => (b || 0) + (p * 0.1));
        save();
        tg.HapticFeedback.impactOccurred('medium');
    } else tg.showAlert("Bạn không đủ vàng!");
}

function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); render(); }
function render() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('rate').innerText = (userData.speed / 24).toFixed(2);
}

function nav(t) {
    ['mine','task','ref','draw'].forEach(id => document.getElementById('tab-'+id).classList.add('hidden'));
    ['mine','task','ref','draw'].forEach(id => document.getElementById('btn-'+id).classList.remove('active-tab'));
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('btn-'+t).classList.add('active-tab');
}

function updateVnd(v) { document.getElementById('vnd-preview').innerText = (v * 0.2).toLocaleString(); }

function withdraw() {
    let g = parseFloat(document.getElementById('draw-gold').value);
    if (g < 25000 || g > userData.balance) return tg.showAlert("Tối thiểu 25.000 vàng (5k VND) và không quá số dư!");
    userData.balance -= g;
    db.ref('withdraws/').push({ uid: user.id, gold: g, info: document.getElementById('draw-info').value, st: 0, time: Date.now() });
    save();
    tg.showAlert("Đã gửi yêu cầu rút tiền!");
}

function useGift() {
    let c = document.getElementById('gift-in').value.toUpperCase();
    db.ref('gifts/' + c).transaction(g => {
        if (!g || (g.users && g.users[user.id]) || g.u >= g.m) return;
        g.u = (g.u || 0) + 1;
        if (!g.users) g.users = {}; g.users[user.id] = true;
        userData.balance += g.v;
        save(); tg.showAlert("Nhận thành công!");
        return g;
    });
}

// Admin Functions
function admAdd() {
    let id = document.getElementById('adm-uid').value;
    let v = parseFloat(document.getElementById('adm-amt').value);
    db.ref('users/' + id + '/balance').transaction(b => (b || 0) + v);
    alert("Đã cộng vàng!");
}

function admGift() {
    let c = document.getElementById('g-code').value.toUpperCase();
    db.ref('gifts/' + c).set({ v: parseInt(document.getElementById('g-val').value), m: parseInt(document.getElementById('g-lim').value), u: 0 });
    alert("Đã tạo code!");
}

setInterval(() => { if (userData.speed > 0) { userData.balance += (userData.speed / 86400); render(); } }, 1000);
init();
