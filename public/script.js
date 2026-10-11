// ==========================================
// 1. SUPABASE
// ==========================================
const SUPABASE_URL = 'https://oxlvurccuambcrtudjta.supabase.co';

// anon (public) key. Frontend дээр байлгахад аюулгүй — гэхдээ Supabase дээр RLS заавал асаалттай байх ёстой.
// ХЭЗЭЭ Ч service_role key-г энд бүү бич.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bHZ1cmNjdWFtYmNydHVkanRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTkwOTYsImV4cCI6MjEwNjg3NTA5Nn0.1a3LT_T0f9LStM-A0SWuIE0XqJ7daZ1d5karJ-gqfBs';

const DB_TABLE = 'account_hudaldaa';
const PROFILES_TABLE = 'profiles';
const URGENT_TABLE = 'urgent_requests';

// Шуурхай зарын төлбөрийн мэдээлэл
const URGENT_FEE_TEXT = ''; // Жишээ: '10,000 ₮' гэж бичвэл төлбөрийн хэсэгт харагдана

// Нэг зарт оруулах зургийн дээд тоо
const MAX_IMAGES = 8;

// CDN-ийн global `supabase`-тэй зөрчилдөхгүйн тулд өөр нэр ашиглана
const supabaseClient = (typeof window !== 'undefined' && window.supabase)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Нууц үг, админ эрх, хэрэглэгчийн жагсаалт localStorage-д ХАДГАЛАГДАХГҮЙ.
// Зөвхөн чат (түр) localStorage-д үлдэнэ.
let currentUser = null;   // { id, email, username, isAdmin, canPostUrgent }
let listings = [];
let chats = loadChats();
let activeChatKey = null;
let currentCategory = 'ALL';

function loadChats() {
    try { return JSON.parse(localStorage.getItem('chats')) || {}; } catch (e) { return {}; }
}
function saveChats() {
    try { localStorage.setItem('chats', JSON.stringify(chats)); } catch (e) { console.error(e); }
}

// ==========================================
// 2. ТУСЛАХ ФУНКЦҮҮД
// ==========================================
function escapeHTML(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// onclick="fn(...)" дотор аюулгүй утга дамжуулах (тоо, текст аль ч төрөл дээр ажиллана)
function jsArg(value) { return escapeHTML(JSON.stringify(value)); }

function validatePassword(password) {
    return password.length >= 8
        && /[A-Z]/.test(password)
        && /[0-9]/.test(password)
        && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
}
function isValidUsername(name) { return /^[\p{L}\p{N}_.\-]+$/u.test(name); }

const PLACEHOLDER_IMG = 'https://picsum.photos/500/300?random=1';

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(PLACEHOLDER_IMG);
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(PLACEHOLDER_IMG);
        r.readAsDataURL(file);
    });
}

async function compressImage(file, maxSize = 800, quality = 0.7) {
    if (!file) return PLACEHOLDER_IMG;
    const dataUrl = await readFileAsDataURL(file);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function getTradeLabel(opt) {
    switch (opt) {
        case 'EQUAL': return '🔄 Ойролцоо үнээр солино';
        case 'PAY_EXTRA': return '⬆️ Дээш нь зөрүү өгнө';
        case 'RECEIVE_EXTRA': return '⬇️ Доош нь зөрүү авна';
        default: return '💰 Зөвхөн зарагдана';
    }
}

function authErrorText(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid api key')) return 'Supabase API түлхүүр буруу байна. script.js дахь SUPABASE_ANON_KEY-г шалгана уу.';
    if (m.includes('invalid login')) return 'Имэйл эсвэл нууц үг буруу байна!';
    if (m.includes('email not confirmed')) return 'Имэйлээ баталгаажуулаагүй байна. Имэйл хайрцгаа шалгана уу.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Энэ имэйл хэдийнэ бүртгэгдсэн байна!';
    if (m.includes('database error')) return 'Хэрэглэгчийн нэр эсвэл имэйл давхардсан байна. Өөр нэр сонгоно уу.';
    if (m.includes('rate limit')) return 'Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.';
    return msg || 'Алдаа гарлаа.';
}

// ==========================================
// 3. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const bind = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };
    bind('registerForm', 'submit', (e) => { e.preventDefault(); handleRegister(); });
    bind('loginForm', 'submit', (e) => { e.preventDefault(); handleLogin(); });
    bind('postForm', 'submit', (e) => { e.preventDefault(); handleCreatePost(); });
    bind('chatForm', 'submit', (e) => { e.preventDefault(); handleSendChatMessage(); });
    bind('urgentForm', 'submit', (e) => { e.preventDefault(); submitUrgentRequest(); });

    setupImageUploader();
    setupDetailViewerGestures();
    setupRealtimeValidation();
    setupModalBackdropClose();
    updateInstallButtonVisibility();
    updateUI();

    if (!supabaseClient) {
        console.error('Supabase CDN ачаалагдсангүй. layout.tsx дахь <script src=".../supabase-js@2"> мөрийг шалгана уу.');
        return;
    }

    // Нэвтэрсэн төлөвийг Supabase session-оос сэргээнэ (бүх төхөөрөмж дээр ажиллана)
    try {
        const { data } = await supabaseClient.auth.getSession();
        if (data && data.session) await loadCurrentUser(data.session.user);
    } catch (e) {
        console.warn('Session сэргээхэд алдаа:', e);
    }

    supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            currentUser = null;
            updateUI();
        }
    });

    updateUI();
    fetchListingsFromSupabase();
});

async function loadCurrentUser(authUser) {
    let profile = null;
    try {
        const { data, error } = await supabaseClient
            .from(PROFILES_TABLE).select('*').eq('id', authUser.id).maybeSingle();
        if (error) console.warn('Profile уншихад алдаа:', error.message);
        profile = data;
    } catch (e) { console.warn(e); }

    currentUser = {
        id: authUser.id,
        email: authUser.email,
        username: (profile && profile.username) || (authUser.user_metadata && authUser.user_metadata.username) || authUser.email.split('@')[0],
        isAdmin: !!(profile && profile.is_admin),
        canPostUrgent: !!(profile && profile.can_post_urgent)
    };
}

// ==========================================
// 4. БҮРТГЭЛИЙН ШАЛГАЛТ (realtime)
// ==========================================
function createStatusElem(parentInput, id) {
    const status = document.createElement('div');
    status.id = id;
    status.style.fontSize = '0.85rem';
    status.style.marginTop = '4px';
    parentInput.parentNode.appendChild(status);
    return status;
}

async function isUsernameTaken(name) {
    if (!supabaseClient) return false;
    // ilike дотор _ % нь wildcard тул escape хийнэ
    const safe = name.replace(/[\\%_]/g, '\\$&');
    const { data, error } = await supabaseClient.from(PROFILES_TABLE).select('id').ilike('username', safe).limit(1);
    if (error) { console.warn('Username шалгахад алдаа:', error.message); return false; }
    return !!(data && data.length);
}

function setupRealtimeValidation() {
    const u = document.getElementById('regUsername');
    const e = document.getElementById('regEmail');
    const p = document.getElementById('regPassword');
    const setStatus = (el, ok, text) => { el.style.color = ok ? '#00ff88' : '#ff2a5f'; el.innerText = (ok ? '✅ ' : '❌ ') + text; };

    if (u) {
        let timer;
        u.addEventListener('input', () => {
            const val = u.value.trim();
            const status = document.getElementById('usernameStatus') || createStatusElem(u, 'usernameStatus');
            clearTimeout(timer);
            if (val.length < 3) return setStatus(status, false, 'Нэр доод тал нь 3 тэмдэгт байх ёстой.');
            if (!isValidUsername(val)) return setStatus(status, false, 'Зөвхөн үсэг, тоо, _ . - ашиглана.');
            timer = setTimeout(async () => {
                const taken = await isUsernameTaken(val);
                taken ? setStatus(status, false, 'Энэ хэрэглэгчийн нэр ашиглагдаж байна.')
                      : setStatus(status, true, 'Боломжтой хэрэглэгчийн нэр.');
            }, 400);
        });
    }
    if (e) {
        e.addEventListener('input', () => {
            const status = document.getElementById('emailStatus') || createStatusElem(e, 'emailStatus');
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.value.trim())
                ? setStatus(status, true, 'Имэйл хаяг зөв байна.')
                : setStatus(status, false, 'Зөв имэйл хаяг оруулна уу.');
        });
    }
    if (p) {
        p.addEventListener('input', () => {
            const status = document.getElementById('passwordStatus') || createStatusElem(p, 'passwordStatus');
            validatePassword(p.value)
                ? setStatus(status, true, 'Нууц үг шаардлага хангасан.')
                : setStatus(status, false, 'Нууц үг: 8+ оронтой, 1 том үсэг, 1 тоо, 1 тусгай тэмдэгт (!@#$%^&*) агуулна.');
        });
    }
}

// ==========================================
// 5. AUTH (Supabase Auth)
// ==========================================
async function handleRegister() {
    if (!supabaseClient) return alert('Supabase холбогдоогүй байна.');
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    if (username.length < 3) return alert('Хэрэглэгчийн нэр доод тал нь 3 тэмдэгт байна!');
    if (!isValidUsername(username)) return alert('Хэрэглэгчийн нэрэнд зөвхөн үсэг, тоо, _ . - ашиглана!');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('Зөв имэйл хаяг оруулна уу!');
    if (!validatePassword(password)) return alert('❌ Нууц үг шаардлага хангахгүй байна!');
    if (await isUsernameTaken(username)) return alert('❌ Энэ хэрэглэгчийн нэр хэдийнэ ашиглагдаж байна!');

    const submitBtn = document.getElementById('regSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password, options: { data: { username } }
        });
        if (error) return alert('❌ ' + authErrorText(error.message));

        // Имэйл баталгаажуулалт асаалттай үед бүртгэлтэй имэйл алдаагүй буцаж ирдэг — identities хоосон байвал давхардсан
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return alert('❌ Энэ имэйл хэдийнэ бүртгэгдсэн байна!');
        }

        closeModals();
        if (data.session) {
            await loadCurrentUser(data.user);
            updateUI();
            fetchListingsFromSupabase();
            alert('Амжилттай бүртгэгдлээ!');
        } else {
            alert('Амжилттай бүртгэгдлээ! Имэйлээ шалгаж баталгаажуулсны дараа нэвтэрнэ үү.');
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleLogin() {
    if (!supabaseClient) return alert('Supabase холбогдоогүй байна.');
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert('❌ ' + authErrorText(error.message));

    await loadCurrentUser(data.user);
    alert(`Сайн байна уу, ${currentUser.username}!`);
    closeModals();
    updateUI();
    fetchListingsFromSupabase();
}

async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    activeChatKey = null;
    updateUI();
}

// ==========================================
// 6. ЗУРАГ ОРУУЛАГЧ (олон зураг, нүүр зураг сонгох, чирж оруулах)
// ==========================================
let selectedImages = []; // { id, file, url }
let selectedImageSeq = 0;

function setupImageUploader() {
    const input = document.getElementById('postImagesInput');
    const uploader = document.getElementById('imageUploader');
    const previews = document.getElementById('uploadPreviews');
    const clearBtn = document.getElementById('uploadClearBtn');
    if (!input || !uploader) return;

    input.addEventListener('change', () => {
        addImageFiles(Array.from(input.files || []));
        input.value = ''; // ижил файлыг дахин сонгох боломжтой болгоно
    });

    if (clearBtn) clearBtn.addEventListener('click', clearSelectedImages);

    ['dragenter', 'dragover'].forEach((evt) => uploader.addEventListener(evt, (e) => {
        e.preventDefault();
        uploader.classList.add('is-dragging');
    }));
    uploader.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && uploader.contains(e.relatedTarget)) return;
        uploader.classList.remove('is-dragging');
    });
    uploader.addEventListener('drop', (e) => {
        e.preventDefault();
        uploader.classList.remove('is-dragging');
        addImageFiles(Array.from((e.dataTransfer && e.dataTransfer.files) || []));
    });

    // Preview дээрх товчлуурууд (устгах / нүүр болгох)
    if (previews) {
        previews.addEventListener('click', (e) => {
            const rm = e.target.closest('[data-remove]');
            const cv = e.target.closest('[data-cover]');
            if (rm) removeSelectedImage(Number(rm.dataset.remove));
            else if (cv) makeCoverImage(Number(cv.dataset.cover));
        });
    }
    renderUploadPreviews();
}

function addImageFiles(files) {
    const images = files.filter((f) => f && f.type && f.type.startsWith('image/'));
    if (images.length < files.length) alert('Зөвхөн зураг файл сонгоно уу.');

    const room = MAX_IMAGES - selectedImages.length;
    if (images.length > room) alert(`Нэг зарт дээд тал нь ${MAX_IMAGES} зураг оруулна.`);

    images.slice(0, Math.max(room, 0)).forEach((file) => {
        selectedImages.push({ id: ++selectedImageSeq, file, url: URL.createObjectURL(file) });
    });
    renderUploadPreviews();
}

function removeSelectedImage(id) {
    const idx = selectedImages.findIndex((i) => i.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(selectedImages[idx].url);
    selectedImages.splice(idx, 1);
    renderUploadPreviews();
}

function makeCoverImage(id) {
    const idx = selectedImages.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const [item] = selectedImages.splice(idx, 1);
    selectedImages.unshift(item);
    renderUploadPreviews();
}

function clearSelectedImages() {
    selectedImages.forEach((i) => URL.revokeObjectURL(i.url));
    selectedImages = [];
    renderUploadPreviews();
}

function renderUploadPreviews() {
    const uploader = document.getElementById('imageUploader');
    const previews = document.getElementById('uploadPreviews');
    const meta = document.getElementById('uploadMeta');
    const count = document.getElementById('uploadCount');
    if (!previews) return;

    const n = selectedImages.length;
    if (uploader) uploader.classList.toggle('has-images', n > 0);
    if (meta) meta.hidden = n === 0;
    if (count) count.textContent = `${n} / ${MAX_IMAGES} зураг`;

    previews.innerHTML = selectedImages.map((it, i) => `
        <div class="upload-thumb ${i === 0 ? 'is-cover' : ''}">
            <img src="${it.url}" alt="Зураг ${i + 1}">
            <span class="thumb-index">${i + 1}</span>
            <button type="button" class="thumb-remove" data-remove="${it.id}" aria-label="Устгах">&times;</button>
            ${i === 0
                ? '<span class="thumb-cover-badge">Нүүр</span>'
                : `<button type="button" class="thumb-cover-btn" data-cover="${it.id}">Нүүр болгох</button>`}
        </div>`).join('')
        + (n > 0 && n < MAX_IMAGES
            ? `<label for="postImagesInput" class="upload-thumb upload-add-more"><span class="add-more-plus">+</span><span>Нэмэх</span></label>`
            : '');
}

// ==========================================
// 7. ЗАРУУД
// ==========================================
async function fetchListingsFromSupabase() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from(DB_TABLE).select('*').order('id', { ascending: false });
    if (error) {
        console.error('Зар татахад алдаа:', error);
        return;
    }
    listings = (data || []).map(item => {
        const cover = item.image_url || item.coverImg || PLACEHOLDER_IMG;
        return {
            id: item.id,
            postNum: item.id,
            game: item.game_type || item.game || 'MLBB',
            title: item.title || 'Зарын нэргүй',
            price: Number(item.price || 0),
            tradeOption: item.trade_option || 'NO',
            phone: item.phone || '',
            facebook: item.facebook || '',
            desc: item.description || item.desc || '',
            coverImg: cover,
            images: Array.isArray(item.images) && item.images.length ? item.images : [cover],
            ownerEmail: item.owner_email || '',
            ownerUsername: item.owner_username || 'Хэрэглэгч',
            isUrgent: !!item.is_urgent,
            isSold: !!item.is_sold
        };
    });
    updateUI();
}

async function handleCreatePost() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    if (selectedImages.length === 0) return alert('Дор хаяж 1 зураг оруулна уу!');

    const submitBtn = document.querySelector('#postForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = '⏳ Байршуулж байна...'; }

    try {
        // Эхний зураг = нүүр зураг
        const imageUrls = [];
        for (const item of selectedImages) imageUrls.push(await compressImage(item.file));
        const coverUrl = imageUrls[0];

        const val = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };

        const { data, error } = await supabaseClient.from(DB_TABLE).insert([{
            game_type: val('gameType', 'MLBB'),
            title: val('postTitle', '').trim(),
            price: Number(val('postPrice', 0)) || 0,
            trade_option: val('tradeOption', 'NO'),
            phone: val('ownerPhone', '').trim(),
            facebook: val('ownerFacebook', '').trim(),
            description: val('postDesc', '').trim(),
            image_url: coverUrl,
            images: imageUrls,
            owner_email: currentUser.email,
            owner_username: currentUser.username
        }]).select().single();

        if (error) {
            console.error(error);
            return alert('❌ Зар хадгалахад алдаа гарлаа: ' + error.message);
        }

        const pForm = document.getElementById('postForm');
        if (pForm) pForm.reset();
        clearSelectedImages();
        closeModals();
        await fetchListingsFromSupabase();
        alert(`Зарыг амжилттай байршууллаа! (#${data.id})`);
    } catch (e) {
        console.error(e);
        alert('❌ Алдаа гарлаа: ' + (e && e.message ? e.message : e));
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = ' Зарыг нийтлэх'; }
    }
}

// ==========================================
// 7.5 ШУУРХАЙ ЗАР (төлбөр + админ баталгаажуулалт)
// ==========================================
function renderUrgentBanner() {
    const banner = document.getElementById('urgentBanner');
    if (!banner) return;
    if (currentCategory !== 'URGENT') { banner.style.display = 'none'; return; }
    banner.style.display = 'block';

    const desc = `<p style="color:#cbd5e1; margin-top:0.9rem; font-size:0.95rem; line-height:1.5;">
        ⚡ <b>Шуурхай зар</b> гэдэг нь мөнгөний хэрэг яаралтай гарсан, яаралтай хямд зарагдах ACCOUNT-ууд юм.
    </p>`;

    banner.innerHTML = (currentUser
        ? `<h3 style="color:#fff; margin-bottom:0.5rem;">⚡ Шуурхай зар тавих уу?</h3>
           <p style="color:#e2e8f0; margin-bottom:0.8rem;">Төлбөрөө хийгээд хүсэлт илгээнэ үү. Админ шалгаж баталгаажуулах болно.</p>
           <button type="button" class="btn btn-urgent" onclick="openUrgentModal()">⚡ Шуурхай зар тавих</button>`
        : `<h3 style="color:#fff; margin-bottom:0.5rem;">⚡ Шуурхай зар тавих уу?</h3>
           <p style="color:#e2e8f0; margin-bottom:0.8rem;">Шуурхай зар тавихын тулд эхлээд <b>нэвтэрч орно уу</b>.</p>
           <button type="button" class="btn btn-primary" onclick="showModal('loginModal')">Нэвтрэх</button>`)
        + desc;
}

async function openUrgentModal() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    const mine = listings.filter(l => l.ownerEmail === currentUser.email && !l.isSold && !l.isUrgent);
    if (mine.length === 0) return alert('Шуурхай болгох боломжтой таны зар алга байна. Эхлээд зар байршуулна уу.');

    let pendingIds = new Set();
    try {
        const { data } = await supabaseClient.from(URGENT_TABLE).select('listing_id').eq('status', 'pending').eq('user_id', currentUser.id);
        pendingIds = new Set((data || []).map(r => String(r.listing_id)));
    } catch (e) { console.warn(e); }
    const available = mine.filter(l => !pendingIds.has(String(l.id)));
    if (available.length === 0) return alert('Таны бүх зарын хүсэлт админы шалгалтыг хүлээж байна.');

    const sel = document.getElementById('urgentListingSelect');
    sel.innerHTML = available.map(l => `<option value="${escapeHTML(l.id)}">#${escapeHTML(l.postNum)} - ${escapeHTML(l.title)}</option>`).join('');
    const updateRef = () => {
        const ref = document.getElementById('urgentRefCode');
        if (ref) ref.innerText = `SHUURHAI-${sel.value}`;
    };
    sel.onchange = updateRef;
    updateRef();

    const feeLine = document.getElementById('urgentFeeLine');
    if (feeLine) feeLine.innerHTML = URGENT_FEE_TEXT ? `Төлбөр: <span class="contact-highlight">${escapeHTML(URGENT_FEE_TEXT)}</span>` : '';

    closeModals();
    showModal('urgentModal');
}

async function submitUrgentRequest() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    const btn = document.querySelector('#urgentForm button[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerText = '⏳ Илгээж байна...'; }
    try {
        const listingId = document.getElementById('urgentListingSelect').value;
        const note = document.getElementById('urgentPayerNote').value.trim();
        const file = document.getElementById('urgentReceiptFile').files[0];
        const item = listings.find(l => String(l.id) === String(listingId));
        if (!item) return alert('Зар олдсонгүй.');
        if (!file) return alert('Гүйлгээний баримтын зургаа оруулна уу.');
        const receipt = await compressImage(file, 1000, 0.7);

        const { error } = await supabaseClient.from(URGENT_TABLE).insert([{
            listing_id: String(item.id),
            listing_title: item.title,
            user_id: currentUser.id,
            user_email: currentUser.email,
            username: currentUser.username,
            payer_note: note,
            receipt_url: receipt,
            status: 'pending'
        }]);
        if (error) {
            console.error(error);
            return alert('❌ Хүсэлт илгээхэд алдаа гарлаа: ' + error.message);
        }
        document.getElementById('urgentForm').reset();
        closeModals();
        alert('✅ Хүсэлт админд илгээгдлээ. Админ төлбөрийг шалгаж баталгаажуулсны дараа зар ШУУРХАЙ болно.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '📨 Админд хүсэлт илгээх'; }
    }
}

async function loadAdminUrgentRequests() {
    const tbody = document.getElementById('adminUrgentTable');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#aaa;">Уншиж байна...</td></tr>`;
    const { data, error } = await supabaseClient.from(URGENT_TABLE).select('*').order('created_at', { ascending: false });
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#ff2a5f;">Алдаа: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#aaa;">Хүсэлт байхгүй байна.</td></tr>`;
        return;
    }
    const statusText = { pending: '<span style="color:#fbbf24;">⏳ Хүлээгдэж байна</span>', approved: '<span style="color:#00ff88;">✅ Баталгаажсан</span>', rejected: '<span style="color:#ff2a5f;">❌ Татгалзсан</span>' };
    tbody.innerHTML = data.map(r => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
            <td style="padding:10px;">${escapeHTML(r.listing_title)}<br><small style="color:#94a3b8;">SHUURHAI-${escapeHTML(r.listing_id)}</small></td>
            <td style="padding:10px;">${escapeHTML(r.username)}<br><small style="color:#94a3b8;">${escapeHTML(r.user_email)}</small></td>
            <td style="padding:10px;">${escapeHTML(r.payer_note)}</td>
            <td style="padding:10px;">${r.receipt_url ? `<img src="${escapeHTML(r.receipt_url)}" alt="Баримт" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="viewReceipt(this.src)">` : '-'}</td>
            <td style="padding:10px;">${statusText[r.status] || escapeHTML(r.status)}</td>
            <td style="padding:10px;">${r.status === 'pending' ? `
                <button type="button" class="btn btn-success" onclick="approveUrgent(${jsArg(r.id)}, ${jsArg(r.listing_id)})" style="padding:6px 10px; font-size:0.75rem; margin-bottom:4px;">✅ Батлах</button>
                <button type="button" class="btn btn-danger" onclick="rejectUrgent(${jsArg(r.id)})" style="padding:6px 10px; font-size:0.75rem;">Татгалзах</button>` : ''}</td>
        </tr>`).join('');
}

// Баримтыг шинэ цонхонд аюулгүй (DOM-оор) нээнэ. Өмнө нь src-г HTML руу шууд бичдэг байсан нь XSS нүх байсан.
function viewReceipt(src) {
    if (!/^(data:image\/(png|jpe?g|webp|gif);|https:\/\/)/i.test(src)) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.title = 'Гүйлгээний баримт';
    w.document.body.style.cssText = 'margin:0;background:#000;display:flex;justify-content:center;';
    const img = w.document.createElement('img');
    img.src = src;
    img.alt = 'Гүйлгээний баримт';
    img.style.cssText = 'max-width:100%;height:auto;';
    w.document.body.appendChild(img);
}

async function approveUrgent(requestId, listingId) {
    if (!confirm('Төлбөр орж ирснийг шалгасан уу? Энэ зарыг ШУУРХАЙ болгох уу?')) return;
    const { error: e1 } = await supabaseClient.from(DB_TABLE).update({ is_urgent: true }).eq('id', listingId);
    if (e1) return alert('❌ Зар шинэчлэхэд алдаа: ' + e1.message);
    const { error: e2 } = await supabaseClient.from(URGENT_TABLE).update({ status: 'approved' }).eq('id', requestId);
    if (e2) return alert('❌ Хүсэлтийн төлөв шинэчлэхэд алдаа: ' + e2.message);
    await fetchListingsFromSupabase();
    openAdminModal();
}

async function rejectUrgent(requestId) {
    if (!confirm('Энэ хүсэлтээс татгалзах уу?')) return;
    const { error } = await supabaseClient.from(URGENT_TABLE).update({ status: 'rejected' }).eq('id', requestId);
    if (error) return alert('❌ Алдаа: ' + error.message);
    openAdminModal();
}

async function updateListing(id, fields) {
    const { error } = await supabaseClient.from(DB_TABLE).update(fields).eq('id', id);
    if (error) { alert('❌ Алдаа: ' + error.message + '\n(Supabase RLS эрхээ шалгана уу)'); return false; }
    return true;
}

async function toggleUrgent(id) {
    const item = listings.find(l => l.id === id);
    if (!item) return;
    if (await updateListing(id, { is_urgent: !item.isUrgent })) {
        await fetchListingsFromSupabase();
        openAdminModal();
    }
}

async function markAsSold(id) {
    if (!confirm('Энэ зарыг ЗАРАГДСАН гэж тэмдэглэх үү?')) return;
    if (await updateListing(id, { is_sold: true })) {
        closeModals();
        await fetchListingsFromSupabase();
    }
}

async function deleteListing(id) {
    if (!confirm('Зарыг устгахдаа итгэлтэй байна уу?')) return;
    const { error } = await supabaseClient.from(DB_TABLE).delete().eq('id', id);
    if (error) return alert('❌ Алдаа: ' + error.message);
    closeModals();
    await fetchListingsFromSupabase();
}

// ==========================================
// 8. АДМИН ХЭСЭГ (эрхийг Supabase RLS шалгана)
// ==========================================
async function openAdminModal() {
    if (!currentUser || !currentUser.isAdmin) return alert('❌ Та админ биш байна!');

    loadAdminUrgentRequests();

    const lTable = document.getElementById('adminListingsTable');
    if (lTable) {
        lTable.innerHTML = listings.length === 0
            ? `<tr><td colspan="5" style="padding:12px; text-align:center; color:#aaa;">Одоогоор зар байхгүй байна.</td></tr>`
            : listings.map(l => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <td style="padding:10px;">#${escapeHTML(l.postNum)}</td>
                    <td style="padding:10px;"><b>${escapeHTML(l.title)}</b> ${l.isSold ? '<span style="color:#aaa;">(Зарагдсан)</span>' : ''}</td>
                    <td style="padding:10px;">${escapeHTML(l.ownerUsername || l.ownerEmail)}</td>
                    <td style="padding:10px;">${l.isSold ? '<span style="color:#aaa;">✅ Зарагдсан</span>' : (l.isUrgent ? '<span style="color:#ff0055; font-weight:bold;">⚡ Шуурхай</span>' : 'Энгийн')}</td>
                    <td style="padding:10px;">
                        <button type="button" class="btn btn-warning" onclick="toggleUrgent(${jsArg(l.id)})" style="padding:6px 10px; font-size:0.75rem; margin-bottom:4px;">Төлөв солих</button>
                        <button type="button" class="btn btn-success" onclick="markAsSold(${jsArg(l.id)})" style="padding:6px 10px; font-size:0.75rem; margin-bottom:4px;">✅ Зарагдсан</button>
                        <button type="button" class="btn btn-danger" onclick="deleteListing(${jsArg(l.id)})" style="padding:6px 10px; font-size:0.75rem;">Устгах</button>
                    </td>
                </tr>`).join('');
    }

    const uTable = document.getElementById('adminUsersTable');
    if (uTable) {
        uTable.innerHTML = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#aaa;">Уншиж байна...</td></tr>`;
        const { data: profiles, error } = await supabaseClient.from(PROFILES_TABLE).select('*').order('username');
        if (error) {
            uTable.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#ff2a5f;">Алдаа: ${escapeHTML(error.message)}</td></tr>`;
        } else if (!profiles || profiles.length === 0) {
            uTable.innerHTML = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#aaa;">Хэрэглэгч байхгүй байна.</td></tr>`;
        } else {
            uTable.innerHTML = profiles.map((u, i) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <td style="padding:10px;">${i + 1}</td>
                    <td style="padding:10px;"><b>${escapeHTML(u.username)}</b></td>
                    <td style="padding:10px;">${escapeHTML(u.email || '')}</td>
                    <td style="padding:10px;">${u.is_admin ? '<b style="color:#ff2a5f;">АДМИН</b>' : 'Хэрэглэгч'}</td>
                    <td style="padding:10px;">${u.can_post_urgent ? '<b style="color:#00ff88;">⚡ Зөвшөөрөгдсөн</b>' : 'Эрхгүй'}</td>
                    <td style="padding:10px;">
                        <button type="button" class="btn btn-primary" onclick="toggleAdminRole(${jsArg(u.id)})" style="padding:6px 10px; font-size:0.75rem; margin-bottom:4px;">${u.is_admin ? 'Цуцлах' : 'Админ болгох'}</button>
                        <button type="button" class="btn btn-warning" onclick="toggleUrgentPermission(${jsArg(u.id)})" style="padding:6px 10px; font-size:0.75rem;">${u.can_post_urgent ? 'Шуурхай -' : 'Шуурхай +'}</button>
                    </td>
                </tr>`).join('');
        }
    }
    showModal('adminModal');
}

async function toggleProfileFlag(userId, column) {
    const { data: row, error: e1 } = await supabaseClient.from(PROFILES_TABLE).select(column).eq('id', userId).single();
    if (e1) return alert('❌ ' + e1.message);
    const { error } = await supabaseClient.from(PROFILES_TABLE).update({ [column]: !row[column] }).eq('id', userId);
    if (error) return alert('❌ Алдаа: ' + error.message);
    if (currentUser && currentUser.id === userId) {
        const { data } = await supabaseClient.auth.getUser();
        if (data && data.user) await loadCurrentUser(data.user);
        updateUI();
    }
    openAdminModal();
}
function toggleAdminRole(userId) { return toggleProfileFlag(userId, 'is_admin'); }
function toggleUrgentPermission(userId) { return toggleProfileFlag(userId, 'can_post_urgent'); }

// ==========================================
// 9. ЧАТ (одоогоор зөвхөн энэ хөтөч дээр)
// ==========================================
function handleSendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !activeChatKey || !chats[activeChatKey] || !currentUser) return;
    chats[activeChatKey].messages.push({
        senderEmail: currentUser.email,
        senderUsername: currentUser.username,
        senderIsAdmin: !!currentUser.isAdmin,
        text: input.value.trim()
    });
    saveChats();
    input.value = '';
    renderChatMessages();
}

function startChat(key, title, sellerEmail, firstText) {
    closeModals();
    if (!chats[key]) {
        chats[key] = { title, sellerEmail, messages: [{ senderEmail: currentUser.email, senderUsername: currentUser.username, text: firstText }] };
    }
    activeChatKey = key;
    saveChats();
    openChatModal();
}

function initiateListingChat(sellerEmail, sellerUsername, postNum, intent) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    startChat(`chat_post${postNum}_${currentUser.email}_${sellerEmail}`,
        `#${postNum} [${currentUser.username} ↔ ${sellerUsername}]`, sellerEmail,
        `Сайн байна уу, #${postNum} зарын дагуу ${intent} сонирхож байна.`);
}
function initiateTradeChat(sellerEmail, sellerUsername, postNum) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    startChat(`chat_trade_post${postNum}_${currentUser.email}_${sellerEmail}`,
        `🔄 Trade #${postNum} [${currentUser.username} ↔ ${sellerUsername}]`, sellerEmail,
        `Сайн байна уу! Би таны #${postNum} зартай аккаунтаа солилцох эсвэл зөрүү тохиролцох сонирхолтой байна.`);
}
function initiateAdminListingChat(postNum) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    startChat(`chat_admin_post${postNum}_${currentUser.email}`,
        `🛡 Escrow #${postNum} [${currentUser.username} ↔ Admin]`, 'admin@gameacc.mn',
        `Сайн байна уу, #${postNum} зарын арилжаанд Админ дундын зуучлагчаар оролцоно уу.`);
}

function openChatModal() { renderChatList(); showModal('chatModal'); }

function renderChatList() {
    const box = document.getElementById('chatListContainer');
    if (!box) return;
    if (!currentUser) { box.innerHTML = '<p style="padding:1rem; color:#aaa;">Нэвтэрч орно уу.</p>'; return; }

    const keys = Object.keys(chats).filter(k => currentUser.isAdmin || k.includes(currentUser.email));
    if (keys.length === 0) {
        box.innerHTML = '<p style="padding:1rem; color:#aaa;">Чат байхгүй байна.</p>';
        const cm = document.getElementById('chatMessages'); if (cm) cm.innerHTML = '';
        return;
    }
    if (!activeChatKey || !keys.includes(activeChatKey)) activeChatKey = keys[0];

    box.innerHTML = keys.map(k => `
        <div class="chat-item ${k === activeChatKey ? 'active' : ''}" onclick="selectChat(${jsArg(k)})" style="padding:12px; cursor:pointer; border-bottom:1px solid #333;">
            <b>${escapeHTML(chats[k].title)}</b>
        </div>`).join('');
    renderChatMessages();
}

function selectChat(k) { activeChatKey = k; renderChatList(); }

function renderChatMessages() {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.innerHTML = '';
    if (!activeChatKey || !chats[activeChatKey] || !currentUser) return;
    box.innerHTML = chats[activeChatKey].messages.map(m => {
        const isMe = m.senderEmail === currentUser.email;
        const tag = m.senderIsAdmin
            ? `<span style="color:#ff2a5f; font-weight:bold;">[ADMIN] </span>`
            : (chats[activeChatKey].sellerEmail === m.senderEmail ? `<span style="color:#00ff88; font-weight:bold;">[ЭЗЭН] </span>` : '');
        return `
            <div class="chat-msg ${isMe ? 'me' : 'other'}" style="margin-bottom:10px; text-align:${isMe ? 'right' : 'left'};">
                <div style="font-size:0.8rem; color:#aaa;">${tag}<b>${escapeHTML(m.senderUsername)}</b></div>
                <div style="display:inline-block; padding:8px 12px; border-radius:8px; background:${isMe ? '#007bff' : '#333'}; color:#fff; margin-top:3px;">${escapeHTML(m.text)}</div>
            </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

// ==========================================
// 10. RENDER
// ==========================================
function renderListings(items) {
    const container = document.getElementById('listingsContainer');
    if (!container) return;
    if (items.length === 0) {
        container.innerHTML = '<p style="color:#aaa; grid-column:1/-1; text-align:center; padding:2rem;">Зар одоогоор байхгүй байна.</p>';
        return;
    }
    container.innerHTML = items.map(item => {
        const sold = item.isSold ? '<span class="sold-badge" style="position:absolute; top:8px; right:8px; background:#555; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; z-index:2;">✅ ЗАРАГДСАН</span>' : '';
        const urgent = (!item.isSold && item.isUrgent) ? '<span class="urgent-badge" style="position:absolute; top:8px; right:8px; background:#ff2a5f; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; z-index:2;">⚡ ШУУРХАЙ</span>' : '';
        return `
            <div class="card ${item.isSold ? 'sold-card' : ''}" onclick="openDetailModal(${jsArg(item.id)})" style="${item.isSold ? 'opacity: 0.6;' : ''}">
                <div class="card-img-wrap" style="position:relative;">
                    <span class="post-number-badge" style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7); color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; z-index:2;">#${escapeHTML(item.postNum)}</span>
                    ${sold}${urgent}
                    <img src="${escapeHTML(item.coverImg)}" class="card-img" alt="${escapeHTML(item.title)}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="card-body" style="padding:1rem;">
                    <div class="badge-group" style="margin-bottom:8px;">
                        <span class="game-badge" style="background:#2a2e3d; color:#00ff88; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-right:5px;">${escapeHTML(item.game)}</span>
                        <span class="trade-badge" style="font-size:0.8rem; color:#aaa;">${getTradeLabel(item.tradeOption)}</span>
                    </div>
                    <h3 class="card-title" style="font-size:1.1rem; margin:5px 0;">${escapeHTML(item.title)}</h3>
                    <div class="card-price" style="font-size:1.2rem; color:#00ff88; font-weight:bold; margin-bottom:10px;">${item.price ? item.price.toLocaleString() : 0} ₮</div>
                    <button type="button" class="btn ${item.isSold ? 'btn-secondary' : 'btn-primary'} btn-full" style="width:100%;">${item.isSold ? 'Зарагдсан' : 'Дэлгэрэнгүй харах'}</button>
                </div>
            </div>`;
    }).join('');
}

// ---------- Дэлгэрэнгүй: зургийн слайдер ----------
let detailImages = [];
let detailIndex = 0;

function setDetailImage(idx) {
    if (!detailImages.length) return;
    detailIndex = (idx + detailImages.length) % detailImages.length;

    const mainImg = document.getElementById('detailMainImg');
    if (mainImg) mainImg.src = detailImages[detailIndex];

    const counter = document.getElementById('detailImgCounter');
    if (counter) counter.textContent = `${detailIndex + 1} / ${detailImages.length}`;

    const gallery = document.getElementById('detailGallery');
    if (gallery) {
        Array.from(gallery.children).forEach((el, i) => el.classList.toggle('active', i === detailIndex));
        const active = gallery.children[detailIndex];
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
}

function stepDetailImage(delta) { setDetailImage(detailIndex + delta); }

function setupDetailViewerGestures() {
    const viewer = document.getElementById('detailViewer');
    if (viewer) {
        let startX = null;
        viewer.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
        viewer.addEventListener('touchend', (e) => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            startX = null;
            if (Math.abs(dx) > 45) stepDetailImage(dx < 0 ? 1 : -1);
        }, { passive: true });
    }
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('detailModal');
        if (!modal || modal.style.display === 'none') return;
        if (e.key === 'ArrowLeft') stepDetailImage(-1);
        else if (e.key === 'ArrowRight') stepDetailImage(1);
    });
}

function openDetailModal(id) {
    const item = listings.find(l => l.id === id);
    if (!item) return;
    const setText = (elId, t) => { const el = document.getElementById(elId); if (el) el.innerText = t; };

    setText('detailPostNumber', `#${item.postNum}`);
    setText('detailBadge', item.game);
    setText('detailTradeBadge', getTradeLabel(item.tradeOption));
    setText('detailTitle', item.title + (item.isSold ? ' (ЗАРАГДСАН)' : ''));
    setText('detailPrice', (item.price ? item.price.toLocaleString() : 0) + ' ₮');
    setText('detailPhone', item.phone || 'Мэдээлэлгүй');
    setText('detailDesc', item.desc);

    const fbElem = document.getElementById('detailFacebook');
    if (fbElem) {
        const fb = item.facebook || '';
        fbElem.innerText = fb || 'Мэдээлэлгүй';
        if (/^https?:\/\//i.test(fb)) fbElem.href = fb;
        else if (/^[\w.\-]+\.[a-z]{2,}(\/.*)?$/i.test(fb)) fbElem.href = `https://${fb}`;
        else fbElem.removeAttribute('href');
    }

    // Зургийн слайдер
    detailImages = item.images && item.images.length ? item.images : [item.coverImg];
    const gallery = document.getElementById('detailGallery');
    if (gallery) {
        gallery.innerHTML = detailImages.length > 1
            ? detailImages.map((u, idx) =>
                `<img src="${escapeHTML(u)}" loading="lazy" alt="Зураг ${idx + 1}" onclick="setDetailImage(${idx})">`
            ).join('')
            : '';
    }
    const multi = detailImages.length > 1;
    ['detailPrevBtn', 'detailNextBtn', 'detailImgCounter'].forEach((elId) => {
        const el = document.getElementById(elId);
        if (el) el.hidden = !multi;
    });
    setDetailImage(0);

    const actionBtns = document.getElementById('detailActionBtns');
    if (actionBtns) {
        let html = '';
        if (currentUser) {
            if (currentUser.email === item.ownerEmail) {
                html += `<button type="button" class="btn btn-danger" onclick="deleteListing(${jsArg(item.id)})">🗑 Миний зарыг устгах</button>`;
            } else if (!item.isSold) {
                html += `<button type="button" class="btn btn-success" onclick="initiateListingChat(${jsArg(item.ownerEmail)}, ${jsArg(item.ownerUsername)}, ${jsArg(item.postNum)}, 'худалдан авах')">💬 ACCOUNT зарж буй хэрэглэгчтай холбогдох</button>`;
                if (item.tradeOption !== 'NO') {
                    html += `<button type="button" class="btn btn-purple" onclick="initiateTradeChat(${jsArg(item.ownerEmail)}, ${jsArg(item.ownerUsername)}, ${jsArg(item.postNum)})">🔄 Солилцох хүсэлт явуулах</button>`;
                }
                html += `<button type="button" class="btn btn-primary" onclick="initiateAdminListingChat(${jsArg(item.postNum)})">🛡 Админтай холбогдох</button>`;
            }
        } else {
            html = '<p style="color:#ff2a5f; margin-top:10px;">Нэвтэрч орж чатална уу.</p>';
        }
        actionBtns.innerHTML = html;
    }
    showModal('detailModal');
}

function filterListings(cat, el) {
    currentCategory = cat;
    document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    updateUI();
}

function updateUI() {
    const authControls = document.getElementById('authControls');
    const addPostSection = document.getElementById('addPostSection');

    if (currentUser) {
        if (authControls) {
            authControls.innerHTML = `
                <span class="user-info" style="margin-right:10px;">${escapeHTML(currentUser.username)} ${currentUser.isAdmin ? '<b style="color:#ff2a5f;">(АДМИН)</b>' : ''}</span>
                <button type="button" class="btn btn-primary" onclick="openChatModal()">💬 Мессеж</button>
                ${currentUser.isAdmin ? '<button type="button" class="btn btn-warning" onclick="openAdminModal()">Админ хэсэг</button>' : ''}
                <button type="button" class="btn btn-danger" onclick="logout()">Гарах</button>`;
        }
        if (addPostSection) addPostSection.style.display = 'block';
    } else {
        if (authControls) {
            authControls.innerHTML = `
                <button type="button" class="btn btn-primary" onclick="showModal('loginModal')">Нэвтрэх</button>
                <button type="button" class="btn btn-success" onclick="showModal('registerModal')">Бүртгүүлэх</button>`;
        }
        if (addPostSection) addPostSection.style.display = 'none';
    }

    renderUrgentBanner();

    const filtered = currentCategory === 'ALL' ? listings
        : currentCategory === 'URGENT' ? listings.filter(i => i.isUrgent)
        : listings.filter(i => i.game === currentCategory);
    renderListings(filtered);
}

// ==========================================
// 11. MODAL — backdrop дарахад хаах, scroll түгжих
// ==========================================
function showModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
    document.body.classList.add('modal-open');
    const content = el.querySelector('.modal-content');
    if (content) content.scrollTop = 0;
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.body.classList.remove('modal-open');
}

function setupModalBackdropClose() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModals();
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModals();
    });
}

// ==========================================
// 12. PWA — Апп болгон суулгах (Android / iOS)
// ==========================================
let deferredInstallPrompt = null;

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function isStandaloneApp() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButtonVisibility() {
    const wrap = document.getElementById('installControls');
    if (!wrap) return;
    wrap.style.display = isStandaloneApp() ? 'none' : 'flex';
}

function switchInstallTab(platform, el) {
    document.querySelectorAll('.install-tab-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    const android = document.getElementById('installStepsAndroid');
    const ios = document.getElementById('installStepsIOS');
    if (android) android.style.display = platform === 'android' ? 'block' : 'none';
    if (ios) ios.style.display = platform === 'ios' ? 'block' : 'none';
}

function handleInstallClick() {
    if (isIOS()) { openInstallModal(); return; }
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
    } else {
        openInstallModal();
    }
}

function openInstallModal() {
    const platform = isIOS() ? 'ios' : 'android';
    const btn = document.querySelector(`.install-tab-btn[data-platform="${platform}"]`);
    switchInstallTab(platform, btn);
    const hint = document.getElementById('androidInstallHint');
    if (hint) {
        hint.textContent = deferredInstallPrompt
            ? ''
            : 'Хэрэв "Суулгах" товч ажиллахгүй бол Chrome цэснээс гараар нэмж болно.';
    }
    showModal('installModal');
}

function triggerAndroidInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; closeModals(); });
    } else {
        alert('Энэ төхөөрөмж/хөтөч автомат суулгах цонх дэмжихгүй байна. Chrome цэс (⋮) → "Add to Home screen" сонгоно уу.');
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButtonVisibility();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    closeModals();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service worker бүртгэхэд алдаа:', e));
    });
}

// Global scope руу гаргах (onclick="..." атрибутууд ашиглана)
Object.assign(window, {
    openAdminModal, toggleUrgent, toggleAdminRole, toggleUrgentPermission,
    deleteListing, markAsSold, showModal, closeModals, logout, filterListings,
    openDetailModal, openChatModal, selectChat, stepDetailImage, setDetailImage,
    initiateListingChat, initiateTradeChat, initiateAdminListingChat,
    openUrgentModal, approveUrgent, rejectUrgent, viewReceipt,
    handleInstallClick, switchInstallTab, triggerAndroidInstall
});
