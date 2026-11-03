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
const CHATS_TABLE = 'chats';
const MESSAGES_TABLE = 'chat_messages';
const NOTIF_TABLE = 'notifications';
const DEALS_TABLE = 'midman_deals';
const CREDS_TABLE = 'midman_credentials';

// ---- МИДНАМ ----
// Шимтгэлийг supabase_midman.sql дахь midman_cancel_fee() / midman_complete_fee()-тэй ЯГ ИЖИЛ байлгана.
const MIDMAN_CANCEL_FEE = 2500;    // цуцлагдвал худалдан авагчид буцаахдаа хасах
const MIDMAN_COMPLETE_FEE = 5000;  // амжилттай болбол худалдагчид шилжүүлэхдээ хасах
// Худалдан авагч мөнгөө шилжүүлэх АДМИНЫ данс (өөрийнхөөрөө солино)
const ADMIN_PAY = { bank: 'Хаан банк', account: '600005005726062671', owner: 'BAT-ERDENE OTGONBAYAR' };

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
let currentCategory = 'ALL';


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
    activeChatId = null;
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
    loadAdminMidman();

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
// 9. ЧАТ (Supabase дээр — бүх төхөөрөмж дээр ажиллана, notification-тэй)
// ==========================================
let chatRows = [];
let activeChatId = null;
let activeMessages = [];

function myEmail() { return currentUser ? String(currentUser.email || '').toLowerCase() : ''; }
function fmtTime(ts) { if (!ts) return ''; try { return new Date(ts).toLocaleString(); } catch (e) { return ''; } }
function fmtMoney(n) { return (Number(n) || 0).toLocaleString() + ' ₮'; }
function modalOpen(id) { const el = document.getElementById(id); return !!el && el.style.display === 'flex'; }

async function startChat(kind, key, title, listingId, otherEmail, otherUsername, firstText) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    closeModals();
    let { data: chat } = await supabaseClient.from(CHATS_TABLE).select('*').eq('chat_key', key).maybeSingle();
    if (!chat) {
        const { data, error } = await supabaseClient.from(CHATS_TABLE).insert([{
            chat_key: key, title, kind, listing_id: String(listingId),
            starter_email: myEmail(), starter_username: currentUser.username,
            other_email: otherEmail ? String(otherEmail).toLowerCase() : null,
            other_username: otherUsername || null
        }]).select().single();
        if (error) return alert('❌ Чат үүсгэхэд алдаа: ' + error.message);
        chat = data;
        const { error: e2 } = await supabaseClient.from(MESSAGES_TABLE).insert([{
            chat_id: chat.id, sender_email: myEmail(), sender_username: currentUser.username, text: firstText
        }]);
        if (e2) console.warn(e2);
    }
    activeChatId = chat.id;
    await openChatModal();
}

function initiateListingChat(sellerEmail, sellerUsername, postNum, intent) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    return startChat('user', `chat_post${postNum}_${myEmail()}_${String(sellerEmail).toLowerCase()}`,
        `#${postNum} [${currentUser.username} ↔ ${sellerUsername}]`, postNum, sellerEmail, sellerUsername,
        `Сайн байна уу, #${postNum} зарын дагуу ${intent} сонирхож байна.`);
}
function initiateTradeChat(sellerEmail, sellerUsername, postNum) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    return startChat('trade', `chat_trade_post${postNum}_${myEmail()}_${String(sellerEmail).toLowerCase()}`,
        `🔄 Trade #${postNum} [${currentUser.username} ↔ ${sellerUsername}]`, postNum, sellerEmail, sellerUsername,
        `Сайн байна уу! Би таны #${postNum} зартай аккаунтаа солилцох эсвэл зөрүү тохиролцох сонирхолтой байна.`);
}
function initiateAdminListingChat(postNum) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    return startChat('admin', `chat_admin_post${postNum}_${myEmail()}`,
        `🛡 Админ #${postNum} [${currentUser.username} ↔ Admin]`, postNum, null, null,
        `Сайн байна уу, #${postNum} зарын талаар админтай холбогдохыг хүсэж байна.`);
}

async function loadChatList() {
    const { data, error } = await supabaseClient.from(CHATS_TABLE).select('*').order('created_at', { ascending: false });
    if (error) { console.error('Чат татахад алдаа:', error); chatRows = []; }
    else chatRows = data || [];
}

async function loadActiveMessages() {
    activeMessages = [];
    if (!activeChatId) return;
    const { data, error } = await supabaseClient.from(MESSAGES_TABLE).select('*')
        .eq('chat_id', activeChatId).order('created_at', { ascending: true });
    if (error) console.error(error);
    activeMessages = data || [];
    markNotifsRead(n => n.ref_type === 'chat' && n.ref_id === activeChatId);
}

async function openChatModal() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    await loadChatList();
    if (!activeChatId || !chatRows.some(c => c.id === activeChatId)) activeChatId = chatRows[0] ? chatRows[0].id : null;
    await loadActiveMessages();
    renderChatList();
    showModal('chatModal');
}

function renderChatList() {
    const box = document.getElementById('chatListContainer');
    if (!box) return;
    if (!currentUser) { box.innerHTML = '<p style="padding:1rem; color:#aaa;">Нэвтэрч орно уу.</p>'; return; }
    if (chatRows.length === 0) {
        box.innerHTML = '<p style="padding:1rem; color:#aaa;">Чат байхгүй байна.</p>';
        const cm = document.getElementById('chatMessages'); if (cm) cm.innerHTML = '';
        return;
    }
    box.innerHTML = chatRows.map(c => {
        const unread = notifs.some(n => !n.is_read && n.ref_type === 'chat' && n.ref_id === c.id);
        return `
        <div class="chat-item ${c.id === activeChatId ? 'active' : ''}" onclick="selectChat(${jsArg(c.id)})" style="padding:12px; cursor:pointer; border-bottom:1px solid #333;">
            ${unread ? '<span class="chat-unread-dot"></span>' : ''}<b>${escapeHTML(c.title)}</b>
        </div>`;
    }).join('');
    renderChatMessages();
}

async function selectChat(id) {
    activeChatId = id;
    await loadActiveMessages();
    renderChatList();
}

function renderChatMessages() {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.innerHTML = '';
    const chat = chatRows.find(c => c.id === activeChatId);
    if (!chat || !currentUser) return;
    box.innerHTML = activeMessages.map(m => {
        const isMe = String(m.sender_email).toLowerCase() === myEmail();
        const tag = m.sender_is_admin
            ? `<span style="color:#ff2a5f; font-weight:bold;">[ADMIN] </span>`
            : (chat.kind !== 'admin' && chat.other_email && chat.other_email === String(m.sender_email).toLowerCase()
                ? `<span style="color:#00ff88; font-weight:bold;">[ЭЗЭН] </span>` : '');
        return `
            <div class="chat-msg ${isMe ? 'me' : 'other'}" style="margin-bottom:10px; text-align:${isMe ? 'right' : 'left'};">
                <div style="font-size:0.8rem; color:#aaa;">${tag}<b>${escapeHTML(m.sender_username)}</b></div>
                <div style="display:inline-block; padding:8px 12px; border-radius:8px; background:${isMe ? '#007bff' : '#333'}; color:#fff; margin-top:3px;">${escapeHTML(m.text)}</div>
            </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

async function handleSendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !activeChatId || !currentUser) return;
    const text = input.value.trim();
    input.value = '';
    const { data, error } = await supabaseClient.from(MESSAGES_TABLE).insert([{
        chat_id: activeChatId, sender_email: myEmail(), sender_username: currentUser.username, text
    }]).select().single();
    if (error) { input.value = text; return alert('❌ Мессеж илгээхэд алдаа: ' + error.message); }
    if (data && !activeMessages.some(x => x.id === data.id)) activeMessages.push(data);
    renderChatMessages();
}

// ==========================================
// 9.1 NOTIFICATION (🔔)
// ==========================================
let notifs = [];
let realtimeUserId = null;
let realtimeChannel = null;
let notifPollTimer = null;

async function loadNotifications() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from(NOTIF_TABLE).select('*')
        .order('created_at', { ascending: false }).limit(60);
    if (error) { console.warn('Notification татахад алдаа:', error.message); return; }
    notifs = data || [];
    renderNotifBadge();
    if (modalOpen('notifModal')) renderNotifList();
}

function renderNotifBadge() {
    const el = document.getElementById('notifBadge');
    if (!el) return;
    const n = notifs.filter(x => !x.is_read).length;
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
}

async function markNotifsRead(filterFn) {
    const ids = notifs.filter(n => !n.is_read && filterFn(n)).map(n => n.id);
    if (!ids.length) return;
    notifs.forEach(n => { if (ids.includes(n.id)) n.is_read = true; });
    renderNotifBadge();
    try { await supabaseClient.from(NOTIF_TABLE).update({ is_read: true }).in('id', ids); } catch (e) { console.warn(e); }
}

function openNotifModal() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    renderNotifList();
    showModal('notifModal');
    loadNotifications();
}

function renderNotifList() {
    const box = document.getElementById('notifList');
    if (!box) return;
    if (notifs.length === 0) { box.innerHTML = '<p style="padding:1rem; color:#aaa;">Мэдэгдэл байхгүй байна.</p>'; return; }
    box.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="openNotification(${jsArg(n.id)})">
            <div class="notif-title">${escapeHTML(n.title)}</div>
            ${n.body ? `<div class="notif-body">${escapeHTML(n.body)}</div>` : ''}
            <div class="notif-time">${escapeHTML(fmtTime(n.created_at))}</div>
        </div>`).join('');
}

async function openNotification(id) {
    const n = notifs.find(x => x.id === id);
    if (!n) return;
    await markNotifsRead(x => x.id === id);
    closeModals();
    if (n.ref_type === 'chat') { activeChatId = n.ref_id; await openChatModal(); }
    else if (n.ref_type === 'deal') { await openDeal(Number(n.ref_id)); }
}

async function markAllNotifsRead() {
    await markNotifsRead(() => true);
    renderNotifList();
}

function showToast(title, body, onClick) {
    let box = document.getElementById('toastBox');
    if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<b>${escapeHTML(title)}</b><span>${escapeHTML(body || '')}</span>`;
    t.onclick = () => { t.remove(); if (onClick) onClick(); };
    box.appendChild(t);
    setTimeout(() => t.remove(), 7000);
}

async function onNotifInsert(payload) {
    const n = payload.new;
    if (!n || notifs.some(x => x.id === n.id)) return;
    const chatOpenNow = n.ref_type === 'chat' && n.ref_id === activeChatId && modalOpen('chatModal');
    if (chatOpenNow) {
        n.is_read = true;
        try { await supabaseClient.from(NOTIF_TABLE).update({ is_read: true }).eq('id', n.id); } catch (e) { /* ignore */ }
    }
    notifs.unshift(n);
    renderNotifBadge();
    if (modalOpen('notifModal')) renderNotifList();
    if (!chatOpenNow) showToast(n.title, n.body, () => openNotification(n.id));
    if (n.ref_type === 'chat' && modalOpen('chatModal') && !chatRows.some(c => c.id === n.ref_id)) {
        await loadChatList(); renderChatList();
    }
}

function onMessageInsert(payload) {
    const m = payload.new;
    if (!m || m.chat_id !== activeChatId || !modalOpen('chatModal')) return;
    if (!activeMessages.some(x => x.id === m.id)) activeMessages.push(m);
    renderChatMessages();
}

function onDealChange(payload) {
    const row = payload.new;
    if (modalOpen('midmanModal')) {
        if (activeDealId && row && row.id === activeDealId) openDeal(activeDealId);
        else if (!activeDealId) openMidmanList();
    }
    if (modalOpen('adminModal')) loadAdminMidman();
}

// Нэвтэрсэн үед нэг удаа асаана / гарсан үед унтраана (updateUI дотроос дуудагдана)
function syncRealtime() {
    if (!supabaseClient) return;
    if (currentUser && realtimeUserId !== currentUser.id) {
        stopRealtime();
        realtimeUserId = currentUser.id;
        realtimeChannel = supabaseClient.channel('app-' + currentUser.id)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIF_TABLE }, (p) => {
                if (p.new && String(p.new.user_email).toLowerCase() === myEmail()) onNotifInsert(p);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: MESSAGES_TABLE }, onMessageInsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: DEALS_TABLE }, onDealChange)
            .subscribe();
        loadNotifications();
        notifPollTimer = setInterval(loadNotifications, 30000);
    } else if (!currentUser && realtimeUserId) {
        stopRealtime();
        notifs = []; chatRows = []; activeChatId = null; activeMessages = [];
    }
}
function stopRealtime() {
    if (realtimeChannel) { try { supabaseClient.removeChannel(realtimeChannel); } catch (e) { /* ignore */ } }
    realtimeChannel = null; realtimeUserId = null;
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = null;
}

// ==========================================
// 9.2 МИДНАМ (админ дундын зуучлагчтай аюулгүй худалдан авалт)
// ==========================================
let activeDealId = null;

const MM_STATUS_TEXT = {
    awaiting_payment: '💳 Төлбөр хүлээж байна',
    payment_claimed: '⏳ Админ төлбөр шалгаж байна',
    payment_confirmed: '📝 Худалдагч мэдээлэл оруулна',
    info_submitted: '🔎 Админ account шалгаж байна',
    info_rejected: '⚠️ Худалдагч засч дахин илгээнэ',
    verified: '📥 Худалдан авагч хүлээн авна',
    buyer_received: '💸 Админ худалдагчид шилжүүлнэ',
    completed: '✅ Амжилттай дууссан',
    cancelled: '❌ Цуцлагдсан'
};
// Төлөв бүрт хэн үйлдэл хийх ёстой вэ
const MM_WAITING_ON = {
    awaiting_payment: 'buyer', payment_claimed: 'admin', payment_confirmed: 'seller', info_rejected: 'seller',
    info_submitted: 'admin', verified: 'buyer', buyer_received: 'admin'
};

function mmStepIndex(status) {
    switch (status) {
        case 'awaiting_payment': return 0;
        case 'payment_claimed': return 1;
        case 'payment_confirmed': case 'info_rejected': return 2;
        case 'info_submitted': return 3;
        case 'verified': return 4;
        case 'buyer_received': return 5;
        case 'completed': return 6;
        default: return -1;
    }
}

function dealRole(d) {
    const me = myEmail();
    if (d.buyer_email === me) return 'buyer';
    if (d.seller_email === me) return 'seller';
    return currentUser && currentUser.isAdmin ? 'admin' : 'none';
}

function midmanErr(msg) {
    const m = String(msg || '');
    if (m.includes('midman_one_active_per_listing') || m.includes('duplicate key')) return 'Энэ зар дээр миднам аль хэдийн явагдаж байна.';
    return m || 'Алдаа гарлаа.';
}

async function startMidman(listingId) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    const item = listings.find(l => l.id === listingId);
    if (!item) return;
    const msg = `🤝 МИДНАМ — #${item.postNum} "${item.title}"\nҮнэ: ${fmtMoney(item.price)}\n\n`
        + `1) Та мөнгөө эхлээд АДМИНД шилжүүлнэ.\n2) Админ төлбөрийг баталгаажуулсны дараа худалдагч account-аа админд өгнө.\n`
        + `3) Админ шалгаж, зөв бол танд өгнө.\n4) Та хүлээн авсны дараа л мөнгө худалдагчид очно.\n\n`
        + `Цуцлагдвал ${fmtMoney(MIDMAN_CANCEL_FEE)} хасаж буцаана. Амжилттай болбол ${fmtMoney(MIDMAN_COMPLETE_FEE)} шимтгэл авна.\n\nЭхлүүлэх үү?`;
    if (!confirm(msg)) return;
    const { data, error } = await supabaseClient.rpc('midman_create', { p_listing_id: String(item.id) });
    if (error) return alert('❌ ' + midmanErr(error.message));
    closeModals();
    await openDeal(Number(data));
}

async function openMidmanList() {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    activeDealId = null;
    if (!modalOpen('midmanModal')) { closeModals(); showModal('midmanModal'); }
    const body = document.getElementById('midmanBody');
    const title = document.getElementById('midmanTitle');
    if (title) title.textContent = currentUser.isAdmin ? '🤝 Бүх миднам гүйлгээ' : '🤝 Миний миднам гүйлгээнүүд';
    if (!body) return;
    body.innerHTML = '<p style="color:#aaa;">Уншиж байна...</p>';
    const { data, error } = await supabaseClient.from(DEALS_TABLE).select('*').order('id', { ascending: false });
    if (error) { body.innerHTML = `<p style="color:#ff2a5f;">Алдаа: ${escapeHTML(error.message)}</p>`; return; }
    if (!data || data.length === 0) { body.innerHTML = '<p style="color:#aaa;">Миднам гүйлгээ байхгүй байна. Зар дээр "🤝 Миднам" товчийг дарж эхлүүлнэ.</p>'; return; }
    body.innerHTML = data.map(d => {
        const role = dealRole(d);
        const myTurn = MM_WAITING_ON[d.status] === role;
        return `
        <div class="mm-row ${myTurn ? 'mm-myturn' : ''}">
            <div>
                <b>#${escapeHTML(d.id)} · ${escapeHTML(d.listing_title || '')}</b>
                <div class="mm-sub">${fmtMoney(d.price)} · ${escapeHTML(d.buyer_username || d.buyer_email)} → ${escapeHTML(d.seller_username || d.seller_email)} · <i>${role === 'buyer' ? 'Та худалдан авагч' : role === 'seller' ? 'Та худалдагч' : 'Админ'}</i></div>
                <div class="mm-sub">${MM_STATUS_TEXT[d.status] || escapeHTML(d.status)}${myTurn ? ' · <b style="color:#ffb020;">🔔 Таны ээлж</b>' : ''}</div>
            </div>
            <button type="button" class="btn btn-primary" onclick="openDeal(${jsArg(d.id)})">Нээх</button>
        </div>`;
    }).join('');
}

async function openDeal(id) {
    if (!currentUser) return alert('Нэвтэрч орно уу!');
    activeDealId = id;
    if (!modalOpen('midmanModal')) { closeModals(); showModal('midmanModal'); }
    const body = document.getElementById('midmanBody');
    if (body && !body.querySelector('.mm-wrap')) body.innerHTML = '<p style="color:#aaa;">Уншиж байна...</p>';
    const { data: d, error } = await supabaseClient.from(DEALS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error || !d) { if (body) body.innerHTML = `<p style="color:#ff2a5f;">Гүйлгээ олдсонгүй. ${escapeHTML(error ? error.message : '')}</p>`; return; }
    const { data: creds } = await supabaseClient.from(CREDS_TABLE).select('*').eq('deal_id', id).maybeSingle();
    markNotifsRead(n => n.ref_type === 'deal' && n.ref_id === String(id));
    renderDeal(d, creds || null);
}

function mmInfoCard(d, creds, role) {
    const canSee = (role === 'admin' || role === 'seller')
        ? !!d.info_submitted_at
        : (role === 'buyer' && ['verified', 'buyer_received', 'completed'].includes(d.status));
    if (!canSee) return '';
    const credHtml = creds ? `
        <div class="mm-creds">
            <div>📧 Gmail / Нэвтрэх нэр: <code>${escapeHTML(creds.login_email)}</code></div>
            <div>🔑 Нууц үг: <code>${escapeHTML(creds.login_password)}</code></div>
            ${creds.extra ? `<div>➕ Нэмэлт: <code>${escapeHTML(creds.extra)}</code></div>` : ''}
        </div>` : '';
    const who = role === 'buyer' ? 'Таны авах account' : role === 'seller' ? 'Таны оруулсан мэдээлэл' : 'Худалдагчийн оруулсан account';
    return `
    <div class="mm-info">
        <h4>🎮 ${who}</h4>
        <div class="mm-pre">${escapeHTML(d.acc_description || '')}</div>
        ${d.acc_bindings ? `<div class="mm-sub" style="margin-top:6px;">🔗 Холбоос (bind): ${escapeHTML(d.acc_bindings)}</div>` : ''}
        ${credHtml}
    </div>`;
}

function renderDeal(d, creds) {
    const body = document.getElementById('midmanBody');
    const title = document.getElementById('midmanTitle');
    if (!body) return;
    if (title) title.textContent = `🤝 Миднам #${d.id}`;
    const role = dealRole(d);
    const idx = mmStepIndex(d.status);
    const cancelled = d.status === 'cancelled';
    const finished = d.status === 'completed';
    const id = d.id;
    const ts = [d.payment_claimed_at, d.payment_confirmed_at, d.info_submitted_at, d.verified_at, d.buyer_received_at, d.completed_at, d.completed_at];
    const WHO = { buyer: 'Худалдан авагч', seller: 'Худалдагч', admin: 'Админ' };

    const payout = Math.max(Number(d.price) - Number(d.complete_fee), 0);
    const refund = Math.max(Number(d.price) - Number(d.cancel_fee), 0);

    const btn = (i, who, label, onclick, cls = 'btn-success') => {
        const active = !cancelled && !finished && idx === i && role === who;
        return `<button type="button" class="btn ${cls} mm-btn" ${active ? `onclick="${onclick}"` : 'disabled'}>${label}</button>`;
    };
    const waitNote = (i, who, text) => (!cancelled && !finished && idx === i && role !== who)
        ? `<div class="mm-wait">⏳ ${text}</div>` : '';

    const sellerForm = (!cancelled && idx === 2 && role === 'seller') ? `
        ${d.status === 'info_rejected' ? `<div class="mm-reject">❌ Админ: ${escapeHTML(d.reject_reason || 'Account буруу байна. Зөв бичээд дахин илгээнэ үү.')}</div>` : ''}
        <div class="mm-form">
            <label>Account-ийн дэлгэрэнгүй (level, rank, skin, хэдэн хувцас гэх мэт)</label>
            <textarea id="mmDesc" rows="4">${escapeHTML(d.acc_description || '')}</textarea>
            <label>Юутай холбоотой байгаа вэ? (Facebook, Google, Moonton, Apple ID, утасны дугаар гэх мэт)</label>
            <textarea id="mmBind" rows="2">${escapeHTML(d.acc_bindings || '')}</textarea>
            <label>📧 Gmail / Нэвтрэх нэр</label>
            <input type="text" id="mmGmail" autocomplete="off" value="${escapeHTML(creds ? creds.login_email : '')}">
            <label>🔑 Нууц үг</label>
            <input type="text" id="mmPass" autocomplete="off" value="${escapeHTML(creds ? creds.login_password : '')}">
            <label>➕ Нэмэлт (2FA код, нууц асуулт гэх мэт — заавал биш)</label>
            <input type="text" id="mmExtra" autocomplete="off" value="${escapeHTML(creds && creds.extra ? creds.extra : '')}">
            <button type="button" class="btn btn-success mm-btn" onclick="submitMidmanInfo(${jsArg(id)})">📨 Админд илгээх</button>
            <div class="mm-sub">Gmail, нууц үгийг зөвхөн админ харна. Шалгасны дараа л худалдан авагчид очино.</div>
        </div>` : '';

    const payBox = (!cancelled && idx === 0 && role === 'buyer') ? `
        <div class="mm-pay">
            <div>🏦 Банк: <b>${escapeHTML(ADMIN_PAY.bank)}</b></div>
            <div>💳 Данс: <b>${escapeHTML(ADMIN_PAY.account)}</b></div>
            <div>👤 Нэр: <b>${escapeHTML(ADMIN_PAY.owner)}</b></div>
            <div>💰 Дүн: <b>${fmtMoney(d.price)}</b></div>
            <div>📝 Гүйлгээний утга: <b>MIDNAM-${escapeHTML(d.id)}</b></div>
        </div>` : '';

    const cards = [
        { who: 'buyer', title: 'Төлбөр хийх', inner: payBox + waitNote(0, 'buyer', 'Худалдан авагч админд төлбөр хийхийг хүлээж байна')
            + btn(0, 'buyer', '✅ Мөнгө шилжүүлсэн', `midmanClaimPayment(${jsArg(id)})`)
            + ((!cancelled && idx === 0 && role === 'buyer') ? `<button type="button" class="btn btn-danger mm-btn" onclick="midmanBuyerCancel(${jsArg(id)})">Болих</button>` : '') },
        { who: 'admin', title: 'Админ мөнгө орж ирснийг баталгаажуулах', inner: waitNote(1, 'admin', 'Админ данс шалгаж байна')
            + btn(1, 'admin', '💰 Мөнгө орж ирсэн', `midmanAdminAct(${jsArg(id)}, 'confirm_payment')`) },
        { who: 'seller', title: 'Худалдагч account-ийн мэдээлэл өгөх', inner: sellerForm + waitNote(2, 'seller', d.status === 'info_rejected' ? 'Худалдагч мэдээллээ засч байна' : 'Худалдагч account-ийн мэдээлэл оруулж байна') },
        { who: 'admin', title: 'Админ account шалгах', inner: waitNote(3, 'admin', 'Админ account-д орж шалгаж байна')
            + `<div class="mm-btnrow">`
            + btn(3, 'admin', '✅ Account зөв — шалгалаа', `midmanAdminAct(${jsArg(id)}, 'verify_info')`)
            + btn(3, 'admin', '❌ Account буруу', `midmanRejectInfo(${jsArg(id)})`, 'btn-danger')
            + `</div>` },
        { who: 'buyer', title: 'Худалдан авагч account хүлээн авах', inner: waitNote(4, 'buyer', 'Худалдан авагч account-аа шалгаж байна')
            + ((!cancelled && idx === 4 && role === 'buyer') ? `<div class="mm-sub">Account-д орж, бүх зүйлийг (холбоос, имэйл, нууц үг) өөрийнхөөрөө солиод бүрэн шалгасны дараа л дарна уу.</div>` : '')
            + btn(4, 'buyer', '📥 Account хүлээн авлаа', `midmanConfirmReceived(${jsArg(id)})`) },
        { who: 'admin', title: `Админ худалдагчид шилжүүлэх (${fmtMoney(payout)})`, inner: waitNote(5, 'admin', 'Админ худалдагчид мөнгө шилжүүлнэ')
            + btn(5, 'admin', `💸 Худалдагчид ${fmtMoney(payout)} шилжүүлсэн`, `midmanAdminAct(${jsArg(id)}, 'complete')`) },
        { who: 'admin', title: 'Гүйлгээ дууссан', inner: finished ? `<div class="mm-ok">🎉 Гүйлгээ амжилттай дууслаа. Худалдагчид ${fmtMoney(d.payout_amount)} шилжүүлсэн.</div>` : '' }
    ];

    const stepsHtml = cards.map((c, i) => {
        const done = cancelled ? !!ts[i] : (finished || idx > i);
        const state = done ? 'done' : (!cancelled && idx === i ? 'current' : 'pending');
        const when = ts[i] && done ? `<span class="mm-when">${escapeHTML(fmtTime(ts[i]))}</span>` : '';
        const turn = state === 'current' && MM_WAITING_ON[d.status] === role ? '<span class="mm-turn">🔔 Таны ээлж</span>' : '';
        return `
        <div class="mm-step ${state}">
            <div class="mm-num">${done ? '✓' : (i + 1)}</div>
            <div class="mm-main">
                <div class="mm-head"><b>${escapeHTML(c.title)}</b> <span class="mm-who">${WHO[c.who]}</span> ${turn} ${when}</div>
                ${c.inner}
            </div>
        </div>`;
    }).join('');

    const cancelBanner = cancelled ? `
        <div class="mm-reject">❌ Гүйлгээ цуцлагдлаа${d.refund_amount ? ` — худалдан авагчид ${fmtMoney(d.refund_amount)} буцаана (шимтгэл ${fmtMoney(d.cancel_fee)} хасагдсан)` : ' — төлбөр хийгдээгүй'}.<br>
        <small>${escapeHTML(d.cancel_reason || '')}</small></div>` : '';

    const adminCancel = (!cancelled && !finished && role === 'admin')
        ? `<button type="button" class="btn btn-danger mm-btn" onclick="midmanCancel(${jsArg(id)}, ${d.status === 'awaiting_payment'})">🚫 Гүйлгээ цуцлах</button>` : '';

    body.innerHTML = `
    <div class="mm-wrap">
        <button type="button" class="btn btn-secondary" onclick="openMidmanList()" style="margin-bottom:10px;">← Жагсаалт</button>
        <div class="mm-top">
            <div><b>#${escapeHTML(d.listing_id)} ${escapeHTML(d.listing_title || '')}</b> <span class="game-badge">${escapeHTML(d.game || '')}</span></div>
            <div class="detail-price">${fmtMoney(d.price)}</div>
            <div class="mm-sub">Худалдан авагч: <b>${escapeHTML(d.buyer_username || d.buyer_email)}</b> · Худалдагч: <b>${escapeHTML(d.seller_username || d.seller_email)}</b></div>
            <div class="mm-sub">Цуцлагдвал ${fmtMoney(d.cancel_fee)} хасаж буцаана (${fmtMoney(refund)}). Амжилттай болбол ${fmtMoney(d.complete_fee)} шимтгэл (${fmtMoney(payout)} худалдагчид).</div>
        </div>
        ${cancelBanner}
        ${mmInfoCard(d, creds, role)}
        <div class="mm-steps">${stepsHtml}</div>
        ${adminCancel}
    </div>`;
}

async function midmanAct(dealId, action, payload = {}) {
    const { error } = await supabaseClient.rpc('midman_act', { p_deal_id: Number(dealId), p_action: action, p_payload: payload });
    if (error) { alert('❌ ' + midmanErr(error.message)); await openDeal(Number(dealId)); return false; }
    await openDeal(Number(dealId));
    if (modalOpen('adminModal')) loadAdminMidman();
    return true;
}
function midmanClaimPayment(id) {
    if (!confirm('Админы дансанд мөнгөө шилжүүлсэн мөн үү?')) return;
    return midmanAct(id, 'claim_payment');
}
function midmanBuyerCancel(id) {
    if (!confirm('Төлбөр хийхээс өмнө болих уу?')) return;
    return midmanAct(id, 'buyer_cancel');
}
function midmanAdminAct(id, action) {
    const q = {
        confirm_payment: 'Мөнгө данс руу орж ирснийг шалгасан уу?',
        verify_info: 'Account-д орж шалгасан, бүх зүйл зөв үү? Мэдээлэл худалдан авагч руу автоматаар очно.',
        complete: 'Худалдагчид мөнгийг шилжүүлсэн үү? Зар ЗАРАГДСАН болно.'
    };
    if (!confirm(q[action] || 'Итгэлтэй байна уу?')) return;
    return midmanAct(id, action);
}
function midmanRejectInfo(id) {
    const reason = prompt('Худалдагч руу автоматаар илгээгдэх тайлбар:', 'Account-ийн Gmail эсвэл нууц үг буруу байна. Зөв бичээд дахин илгээнэ үү.');
    if (reason === null) return;
    return midmanAct(id, 'reject_info', { reason });
}
function midmanConfirmReceived(id) {
    if (!confirm('Account-ыг бүрэн хүлээн авч, шалгасан уу? Дарсны дараа мөнгө худалдагчид очно.')) return;
    return midmanAct(id, 'confirm_received');
}
function midmanCancel(id, noPayment) {
    const reason = prompt(noPayment
        ? 'Цуцлах шалтгаан:'
        : `Цуцлах шалтгаан (худалдан авагчид ${fmtMoney(MIDMAN_CANCEL_FEE)} хасаад буцаана):`, 'Худалдагч залилсан / account зөрсөн');
    if (reason === null) return;
    return midmanAct(id, 'cancel', { reason });
}
async function submitMidmanInfo(id) {
    const g = (x) => { const el = document.getElementById(x); return el ? el.value.trim() : ''; };
    const payload = { description: g('mmDesc'), bindings: g('mmBind'), login_email: g('mmGmail'), login_password: g('mmPass'), extra: g('mmExtra') };
    if (!payload.description) return alert('Account-ийн дэлгэрэнгүйг бичнэ үү.');
    if (!payload.login_email || !payload.login_password) return alert('Gmail болон нууц үгээ заавал бичнэ үү.');
    if (!confirm('Account-ийн мэдээллийг админд илгээх үү?')) return;
    return midmanAct(id, 'submit_info', payload);
}

// Админ хэсэг доторх миднам хүснэгт
async function loadAdminMidman() {
    const tbody = document.getElementById('adminMidmanTable');
    if (!tbody) return;
    const { data, error } = await supabaseClient.from(DEALS_TABLE).select('*').order('id', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#ff2a5f;">Алдаа: ${escapeHTML(error.message)}</td></tr>`; return; }
    if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#aaa;">Миднам гүйлгээ байхгүй байна.</td></tr>`; return; }
    tbody.innerHTML = data.map(d => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
            <td style="padding:10px;">#${escapeHTML(d.id)}</td>
            <td style="padding:10px;">${escapeHTML(d.listing_title || '')}<br><small style="color:#94a3b8;">MIDNAM-${escapeHTML(d.id)}</small></td>
            <td style="padding:10px;">${escapeHTML(d.buyer_username || d.buyer_email)}</td>
            <td style="padding:10px;">${escapeHTML(d.seller_username || d.seller_email)}</td>
            <td style="padding:10px;">${fmtMoney(d.price)}</td>
            <td style="padding:10px;">${MM_STATUS_TEXT[d.status] || escapeHTML(d.status)}${MM_WAITING_ON[d.status] === 'admin' ? '<br><b style="color:#ffb020;">🔔 Таны ээлж</b>' : ''}</td>
            <td style="padding:10px;"><button type="button" class="btn btn-primary" style="padding:6px 10px; font-size:0.75rem;" onclick="openDeal(${jsArg(d.id)})">Нээх</button></td>
        </tr>`).join('');
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
                html += `<button type="button" class="btn btn-warning" onclick="startMidman(${jsArg(item.id)})">🤝 Миднам (админ дундуур аюулгүй авах)</button>`;
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
                <button type="button" class="btn btn-success" onclick="openMidmanList()">🤝 Миднам</button>
                <button type="button" class="btn btn-purple notif-btn" onclick="openNotifModal()" aria-label="Мэдэгдэл">🔔<span id="notifBadge" class="notif-badge" hidden>0</span></button>
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
    renderNotifBadge();
    syncRealtime();

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
    handleInstallClick, switchInstallTab, triggerAndroidInstall,
    openNotifModal, openNotification, markAllNotifsRead,
    startMidman, openMidmanList, openDeal, submitMidmanInfo,
    midmanClaimPayment, midmanBuyerCancel, midmanAdminAct, midmanRejectInfo,
    midmanConfirmReceived, midmanCancel
});