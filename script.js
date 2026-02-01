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
const user = tg.initDataUnsafe?.user || { id: 6318057690 };

let userData = { balance: 500, speed: 0, last: Date.now(), tasks: {} };

function init() {
    // Hiển thị công nhân
    const workers = [{n:'ALPHA', p:10}, {n:'DRAGON', p:20}, {n:'HAWK', p:30}, {n:'KILLER', p:40}, {n:'PUGILIST', p:50}, {n:'ROMEO', p:75}];
    const grid = document.getElementById('tab-mine');
    workers.forEach(w => {
        grid.innerHTML += `<div class="bg-white/10 p-4 rounded-3xl text-center border border-white/20">
            <p class="text-[10px] text-yellow-300 font-black">${w.n}</p>
            <button onclick="buy(${w.p}, ${w.p*0.5})" class="w-full bg-white/20 py-2 mt-2 rounded-xl text-[10px]">${w.p} 💰</button>
        </div>`;
    });

    // Lấy dữ liệu từ Firebase
    db.ref('users/' + user.id).on('value', (s) => {
        if (s.exists()) {
            userData = s.val();
        } else {
            db.ref('users/' + user.id).set(userData);
        }
        render();
    });
}

function updateVnd(v) { document.getElementById('vnd-preview').innerText = (v * 0.0005).toLocaleString(); }

function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p; userData.speed += s;
        save();
    } else tg.showAlert("Không đủ vàng!");
}

function doTask(channel, reward, id) {
    if (userData.tasks && userData.tasks[id]) return tg.showAlert("Đã làm rồi!");
    tg.openTelegramLink("https://t.me/" + channel.replace('@', ''));
    tg.showConfirm("Bạn đã tham gia chưa?", (ok) => {
        if (ok) {
            userData.balance += reward;
            if(!userData.tasks) userData.tasks = {};
            userData.tasks[id] = true;
            save();
            tg.showAlert("Thành công!");
        }
    });
}

function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }

function render() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
}

function nav(t) {
    ['mine','task','draw'].forEach(id => document.getElementById('tab-'+id).classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
}

setInterval(() => { if (userData.speed > 0) { userData.balance += (userData.speed / 86400); render(); } }, 1000);
init();
