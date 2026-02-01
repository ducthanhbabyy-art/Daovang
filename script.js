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
const ADMIN_ID = 6318057690; // ID Admin của bạn
const user = tg.initDataUnsafe?.user || { id: ADMIN_ID, first_name: "Admin" };

let userData = { balance: 0, speed: 0, last: Date.now(), tasks: {}, usedCodes: {} };

// Khởi tạo app
function init() {
    tg.expand();
    if (user.id == ADMIN_ID) document.getElementById('btn-admin').classList.remove('hidden');
    
    // Render danh sách thợ đào
    const grid = document.getElementById('tab-mine');
    const workers = [{n:'Alpha', p:10}, {n:'Dragon', p:20}, {n:'Hawk', p:50}, {n:'Beast', p:500}];
    grid.innerHTML = "";
    workers.forEach(w => {
        let daily = w.p * 0.4;
        grid.innerHTML += `
            <div class="bg-white/10 rounded-3xl p-4 text-center border border-white/20">
                <p class="text-[10px] text-yellow-300 font-black uppercase">${w.n}</p>
                <div class="my-2 text-3xl">👤</div>
                <p class="text-[8px] opacity-70">Lãi: ${daily.toLocaleString()} 💰/ngày</p>
                <button onclick="buy(${w.p}, ${daily})" class="mt-2 w-full bg-white/20 py-2 rounded-xl text-xs font-black">${w.p.toLocaleString()} 💰</button>
            </div>`;
    });

    // Lắng nghe dữ liệu User
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

// Xử lý Giftcode (Người dùng)
function redeemGiftcode() {
    const codeInput = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if (!codeInput) return tg.showAlert("Vui lòng nhập mã!");

    if (userData.usedCodes && userData.usedCodes[codeInput]) {
        return tg.showAlert("Mã này bạn đã sử dụng rồi!");
    }

    db.ref('giftcodes/' + codeInput).get().then((snap) => {
        if (snap.exists()) {
            const codeData = snap.val();
            if (codeData.count >= codeData.limit) {
                return tg.showAlert("Mã này đã hết lượt nhập!");
            }

            // Cộng thưởng
            userData.balance += codeData.reward;
            if (!userData.usedCodes) userData.usedCodes = {};
            userData.usedCodes[codeInput] = true;
            
            // Cập nhật lượt dùng của code
            db.ref('giftcodes/' + codeInput + '/count').transaction(c => (c || 0) + 1);
            save();
            document.getElementById('giftcode-input').value = "";
            tg.showAlert(`Chúc mừng! Bạn nhận được ${codeData.reward} Vàng`);
        } else {
            tg.showAlert("Mã Giftcode không tồn tại!");
        }
    });
}

// Tạo Giftcode (Admin)
function createGiftcode() {
    const name = document.getElementById('admin-code-name').value.trim().toUpperCase();
    const reward = parseInt(document.getElementById('admin-code-reward').value);
    const limit = parseInt(document.getElementById('admin-code-limit').value);

    if (!name || isNaN(reward) || isNaN(limit)) return tg.showAlert("Vui lòng nhập đủ thông tin code!");

    db.ref('giftcodes/' + name).set({
        reward: reward,
        limit: limit,
        count: 0
    }).then(() => {
        tg.showAlert("Đã tạo code: " + name);
        document.getElementById('admin-code-name').value = "";
    });
}

// Tỉ lệ rút: 500 vàng = 5000 VND => 1 vàng = 10 VND
function updateVnd(v) {
    document.getElementById('vnd-preview').innerText = (v * 10).toLocaleString();
}

function withdraw() {
    let gold = parseFloat(document.getElementById('draw-gold').value);
    let info = document.getElementById('draw-info').value;
    if (!gold || gold < 500) return tg.showAlert("Tối thiểu rút 500 Vàng!");
    if (gold > userData.balance) return tg.showAlert("Không đủ số dư!");
    if (!info) return tg.showAlert("Nhập thông tin nhận tiền!");

    userData.balance -= gold;
    db.ref('withdraws').push({ 
        uid: user.id, 
        gold: gold, 
        info: info, 
        status: "Pending", 
        time: Date.now() 
    });
    save();
    tg.showAlert("Yêu cầu rút tiền đã được gửi!");
}

function render() {
    if(!userData) return;
    document.getElementById('balance').innerText = userData.balance.toLocaleString(undefined, {
        minimumFractionDigits: 3, maximumFractionDigits: 3
    });
    document.getElementById('rate').innerText = ((userData.speed || 0) / 24).toFixed(2);
}

// Admin: Tải danh sách rút tiền
function loadWithdraws() {
    db.ref('withdraws').on('value', s => {
        const list = document.getElementById('admin-withdraw-list');
        list.innerHTML = "";
        s.forEach(item => {
            const d = item.val();
            if (d.status === "Pending") {
                list.innerHTML += `<div class="bg-black/40 p-3 rounded-xl text-[10px] border border-white/5">
                    UID: ${d.uid} | Vàng: ${d.gold} (${(d.gold * 10).toLocaleString()}đ)<br>
                    <span class="text-yellow-400">${d.info}</span>
                    <div class="flex gap-2 mt-2">
                        <button onclick="approve('${item.key}', true)" class="bg-green-600 px-4 py-1 rounded">DUYỆT</button>
                        <button onclick="approve('${item.key}', false, '${d.uid}', ${d.gold})" class="bg-red-600 px-4 py-1 rounded">HỦY</button>
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
    tg.showAlert("Đã xử lý!");
}

function nav(t) {
    ['mine','task','draw','admin'].forEach(id => {
        document.getElementById('tab-'+id)?.classList.add('hidden');
        document.getElementById('btn-'+id)?.classList.remove('active-tab');
    });
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('btn-'+t).classList.add('active-tab');
    if(t === 'admin') loadWithdraws();
}

function buy(p, s) {
    if (userData.balance >= p) {
        userData.balance -= p;
        userData.speed += s;
        save();
        tg.showAlert("Thành công!");
    } else tg.showAlert("Thiếu vàng!");
}

function save() { userData.last = Date.now(); db.ref('users/' + user.id).set(userData); }

// Chạy tiền mượt
setInterval(() => { 
    if (userData.speed > 0) { 
        userData.balance += (userData.speed / 86400) / 10; 
        render(); 
    } 
}, 100);

init();
