// Cấu hình Firebase
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

// Danh sách 12 thợ đào theo yêu cầu
const workers = [
    {n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:30}, {n:'Killer', p:40},
    {n:'Pugilist', p:50}, {n:'Romeo', p:75}, {n:'Shooter', p:100}, {n:'Warrior', p:150},
    {n:'Casanova', p:200}, {n:'Chieftain', p:250}, {n:'Detector', p:500}, {n:'Beast', p:1000}
];

function init() {
    tg.expand();
    const grid = document.getElementById('tab-mine');
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.5; // Lãi 50% mỗi ngày
        grid.innerHTML += `
            <div class="bg-white/10 backdrop-blur-md rounded-3xl p-4 text-center border border-white/20 shadow-xl">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n} 50%</p>
                <div class="my-2 text-3xl">👤</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-bold border border-white/30 active:scale-90 transition">${w.p} 💰</button>
            </div>`;
    });

    db.ref('users/' + user.id).on('value', (s) => {
        if (s.exists()) {
            userData = s.val();
        } else {
            db.ref('users/' + user.id).set(userData);
        }
        render();
        checkTasks();
    });
}

function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed += s;
        save();
        tg.HapticFeedback.impactOccurred('medium');
    } else tg.showAlert("Bạn không đủ vàng!");
}

function updateVnd(v) { 
    document.getElementById('vnd-preview').innerText = (v * 0.0005).toLocaleString(); 
}

function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (gold > userData.balance || gold <= 0 || !info) return tg.showAlert("Thông tin không hợp lệ!");
    
    userData.balance -= gold;
    db.ref('withdraws').push({ uid: user.id, gold: gold, info: info, status: "Pending", time: Date.now() });
    save();
    tg.showAlert("Đã gửi yêu cầu rút tiền thành công!");
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
    if (userData.tasks) {
        if (userData.tasks[1]) {
            const b = document.getElementById('task-1');
            b.innerText = "XONG"; b.classList.replace('bg-blue-500', 'bg-gray-500'); b.disabled = true;
        }
        if (userData.tasks[2]) {
            const b = document.getElementById('task-2');
            b.innerText = "XONG"; b.classList.replace('bg-blue-500', 'bg-gray-500'); b.disabled = true;
        }
    }
}

function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }

function render() {
    document.getElementById('balance').innerText = userData.balance.toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('rate').innerText = (userData.speed / 24).toFixed(2);
}

function nav(t) {
    ['mine','task','draw'].forEach(id => {
        document.getElementById('tab-'+id).classList.add('hidden');
        document.getElementById('btn-'+id).classList.remove('active-tab');
    });
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('btn-'+t).classList.add('active-tab');
}

setInterval(() => { 
    if (userData.speed > 0) { 
        userData.balance += (userData.speed / 86400); 
        render(); 
    } 
}, 1000);

init();
