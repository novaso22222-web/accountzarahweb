"use client";

import type { CSSProperties, MouseEvent, SyntheticEvent } from "react";

type WindowFn = (...args: unknown[]) => unknown;

const getGlobalFn = (name: string): WindowFn | undefined => {
  if (typeof window === "undefined") return undefined;
  const fn = (window as unknown as Record<string, unknown>)[name];
  return typeof fn === "function" ? (fn as WindowFn) : undefined;
};

// script.js дотор глобал (window) функцуудаар зарлагдсан үйлдлүүдийг
// аюулгүй дуудах туслах функцууд. Функц хараахан ачаалагдаагүй бол алдаа гарахгүй.
const callGlobal = (name: string, ...args: unknown[]) =>
  getGlobalFn(name)?.(...args);

// onclick="fn(a, b)" -> onClick={call("fn", a, b)}
const call =
  (name: string, ...args: unknown[]) =>
  () =>
    callGlobal(name, ...args);

// onclick="fn(a, this)" -> onClick={callOnThis("fn", a)}  (this = дарагдсан элемент)
const callOnThis =
  (name: string, ...args: unknown[]) =>
  (e: MouseEvent<HTMLElement>) =>
    callGlobal(name, ...args, e.currentTarget);

// Лого дээр дарахад: filterListings('ALL', document.querySelector('.tab-btn'))
const showAllListings = () =>
  callGlobal("filterListings", "ALL", document.querySelector(".tab-btn"));

const closeModals = () => {
  getGlobalFn("closeModals")?.();
};

const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

const imgStyle: CSSProperties = {
  width: 20,
  height: 20,
  verticalAlign: "middle",
  marginRight: 5,
  borderRadius: 4,
};

const GAMES = [
  { value: "MLBB", label: "Mobile Legends" },
  { value: "PUBG", label: "PUBG Mobile" },
  { value: "Standoff 2", label: "Standoff 2" },
  { value: "Clash of Clans", label: "Clash of Clans" },
  { value: "Roblox", label: "Roblox" },
  { value: "Spike", label: "Spike" },
];

const GAME_TABS = [
  {
    value: "MLBB",
    label: "Mobile Legends",
    alt: "MLBB",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTZDomgU3MDJcGXkMQ1ZD3qa_2x0dRBtQPRGDigOX-XFG7TeiDt3S9LUv71&s=10",
  },
  {
    value: "PUBG",
    label: "PUBG Mobile",
    alt: "PUBG",
    src: "https://upload.wikimedia.org/wikipedia/en/4/44/PlayerUnknown%27s_Battlegrounds_Mobile.webp",
  },
  {
    value: "Standoff 2",
    label: "Standoff 2",
    alt: "Standoff 2",
    src: "https://play-lh.googleusercontent.com/uAfkyiLUpCY5pk4J5hKGb03q3afDOybzE3F25c6rbBTWaEtvhm6-qLTuO5LhLvnSIuHljRxXA7P6MH_6mAdy3w",
  },
  {
    value: "Clash of Clans",
    label: "Clash of Clans",
    alt: "COC",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSkPvboqr_UT1z-K8EaqabAAFlvZ2o_GmIgCORHHbmqWw&s",
  },
  {
    value: "Roblox",
    label: "Roblox",
    alt: "Roblox",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS1dgew6H0aU5h9k3fzwF_vwgRuC1Q5DeoIlpa8KeoVUw&s",
  },
  {
    value: "Spike",
    label: "Spike",
    alt: "Spike",
    src: "https://play-lh.googleusercontent.com/-UpWtpXqM7_e9QOjDbiEENhCpF6YUn1J1DiKizDReSX87PmdtOLF2fPQn7Z9yzMvRXS4eELH4tJX5bK-HGg5l1Y",
  },
];

const thStyle: CSSProperties = { padding: 10 };
const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: "0.88rem",
};
const hintStyle: CSSProperties = { color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.6rem" };

export default function Page() {
  return (
    <>
      <header>
        <div className="logo" onClick={showAllListings}>
          ACCOUNT<span className="neon-text">HUDALDAA</span>
        </div>

        <div
          className="install-controls"
          id="installControls"
          style={{ display: "none" }}
        >
          <button
            type="button"
            className="btn btn-purple"
            id="installAppBtn"
            onClick={call("handleInstallClick")}
          >
            📲 Апп татах
          </button>
        </div>

        <div className="auth-controls" id="authControls" />
      </header>

      <main className="container">
        {/* HERO */}
        <section className="hero">
          <span className="hero-eyebrow">⚡ Хурдан, аюулгүй, баталгаатай</span>
          <h1 className="hero-title">
            Тоглоомын <span className="grad">аккаунт</span> худалдаа
            <br />
            нэг дор
          </h1>
          <p className="hero-subtitle">
            Mobile Legends, PUBG, Standoff 2 болон бусад тоглоомын аккаунтаа
            худалдаж аваарай эсвэл борлуулаарай — хурдан, найдвартай.
          </p>
        </section>

        {/* ШИНЭ ЗАР НЭМЭХ ХЭСЭГ */}
        <section
          className="add-post-section"
          id="addPostSection"
          style={{ display: "none" }}
        >
          <div className="section-header">
            <h2>
              <span className="icon">⚡</span> Шинэ зар байршуулах
            </h2>
          </div>

          <form id="postForm">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="gameType">Тоглоом:</label>
                <select id="gameType" required>
                  {GAMES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="postTitle">Зарын гарчиг:</label>
                <input
                  type="text"
                  id="postTitle"
                  placeholder="Жишээ: Mythic Glory 80 skin"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="postPrice">Үнэ (₮):</label>
                <input
                  type="number"
                  id="postPrice"
                  inputMode="numeric"
                  min={0}
                  placeholder="50000"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="tradeOption">Солилцох Нөхцөл (Trade):</label>
                <select id="tradeOption" required>
                  <option value="NO">Зөвхөн зарагдана</option>
                  <option value="EQUAL">
                    Ойролцоо үнэтэй аккаунтаар солино
                  </option>
                  <option value="PAY_EXTRA">
                    Дээгүүр аккаунтад зөрүү мөнгө өгнө
                  </option>
                  <option value="RECEIVE_EXTRA">
                    Дор аккаунтаас зөрүү мөнгө авна
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="ownerPhone">Утасны дугаар:</label>
                <input
                  type="tel"
                  id="ownerPhone"
                  inputMode="tel"
                  placeholder="99112233"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="ownerFacebook">Facebook линк / Нэр:</label>
                <input
                  type="text"
                  id="ownerFacebook"
                  placeholder="https://facebook.com/yourprofile"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="postDesc">Дэлгэрэнгүй тайлбар:</label>
              <textarea
                id="postDesc"
                rows={3}
                placeholder="Аккаунтын дэлгэрэнгүй мэдээлэл..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="postImagesInput">
                Зургууд{" "}
                <span className="label-hint">
                  — эхний зураг нүүр зураг болно
                </span>
              </label>

              <div className="uploader" id="imageUploader">
                <input
                  type="file"
                  id="postImagesInput"
                  className="visually-hidden-input"
                  accept="image/*"
                  multiple
                />
                <label
                  htmlFor="postImagesInput"
                  className="upload-drop"
                  id="uploadDrop"
                >
                  <span className="upload-icon" aria-hidden="true">
                    <svg
                      width={26}
                      height={26}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x={3} y={3} width={18} height={18} rx={3} />
                      <circle cx={9} cy={9} r={2} />
                      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                    </svg>
                  </span>
                  <span className="upload-title">Зураг нэмэх</span>
                  <span className="upload-sub">
                    Компьютер, утаснаасаа хэдэн ч зураг нэг дор сонгоно. Чирч
                    оруулж болно.
                  </span>
                </label>

                <div className="upload-meta" id="uploadMeta" hidden>
                  <span id="uploadCount" aria-live="polite" />
                  <button
                    type="button"
                    className="link-btn"
                    id="uploadClearBtn"
                  >
                    Бүгдийг арилгах
                  </button>
                </div>

                <div className="upload-previews" id="uploadPreviews" />
              </div>
            </div>

            <button type="submit" className="btn btn-success btn-full">
              Зарыг нийтлэх
            </button>
          </form>
        </section>

        {/* ШҮҮЛТҮҮР */}
        <h2 className="section-title">Зарууд</h2>
        <div className="filter-tabs">
          <button
            type="button"
            className="tab-btn active"
            onClick={callOnThis("filterListings", "ALL")}
          >
            <span>Бүх Зар</span>
          </button>

          <button
            type="button"
            className="tab-btn tab-urgent"
            onClick={callOnThis("filterListings", "URGENT")}
          >
            ⚡ <span>ШУУРХАЙ</span>
          </button>

          {GAME_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className="tab-btn"
              onClick={callOnThis("filterListings", t.value)}
            >
              <img
                src={t.src}
                alt={t.alt}
                referrerPolicy="no-referrer"
                onError={hideOnError}
                style={imgStyle}
              />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Агуулгыг script.js (renderUrgentBanner) бөглөнө */}
        <div className="urgent-banner" id="urgentBanner" />
        <div className="grid" id="listingsContainer" />
      </main>

      {/* ДЭЛГЭРЭНГҮЙ ХАРАХ MODAL */}
      <div className="modal" id="detailModal" style={{ display: "none" }}>
        <div className="modal-content modal-lg">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>

          <div className="detail-viewer" id="detailViewer">
            <img
              id="detailMainImg"
              className="main-detail-img"
              src=""
              alt="Main Image"
            />
            <button
              type="button"
              className="viewer-nav prev"
              id="detailPrevBtn"
              onClick={call("stepDetailImage", -1)}
              aria-label="Өмнөх"
            >
              ‹
            </button>
            <button
              type="button"
              className="viewer-nav next"
              id="detailNextBtn"
              onClick={call("stepDetailImage", 1)}
              aria-label="Дараах"
            >
              ›
            </button>
            <span className="viewer-counter" id="detailImgCounter" />
          </div>

          <div id="detailGallery" className="gallery-container" />

          <div className="badge-group">
            <span id="detailPostNumber" className="post-number-badge" />
            <span id="detailBadge" className="game-badge" />
            <span id="detailTradeBadge" className="trade-badge" />
          </div>

          <h2 id="detailTitle" className="detail-title" />
          <div id="detailPrice" className="detail-price" />

          <div className="contact-card">
            <h4>📞 Эзэмшигчийн Холбоо Барих:</h4>
            <p>
              📱 Утас: <span id="detailPhone" className="contact-highlight" />
            </p>
            <p>
              🌐 Facebook:{" "}
              <a
                id="detailFacebook"
                className="contact-link"
                href="#"
                target="_blank"
                rel="noopener noreferrer"
              />
            </p>
          </div>

          <p id="detailDesc" className="detail-desc" />
          <div id="detailActionBtns" className="action-btn-group" />
        </div>
      </div>

      {/* ЧАТ MODAL */}
      <div className="modal" id="chatModal" style={{ display: "none" }}>
        <div className="modal-content modal-xl">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h3 id="chatTitle" className="modal-title">
            💬 Мессеж Хэсэг
          </h3>

          <div className="chat-layout">
            <div className="chat-list" id="chatListContainer" />
            <div className="chat-main">
              <div className="chat-box" id="chatMessages" />
              <form id="chatForm" className="chat-form">
                <input
                  type="text"
                  id="chatInput"
                  placeholder="Мессеж бичих..."
                  autoComplete="off"
                  required
                />
                <button type="submit" className="btn btn-primary">
                  Илгээх
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* АДМИН УДИРДАХ ЦОНХ */}
      <div id="adminModal" className="modal" style={{ display: "none" }}>
        <div
          className="modal-content modal-xl"
          style={{ maxWidth: 950, maxHeight: "88vh", overflowY: "auto" }}
        >
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h2
            className="modal-title admin-title"
            style={{ color: "var(--accent-red)", marginBottom: "1.2rem" }}
          >
            🛠 Админ Удирдах Хэсэг
          </h2>

          {/* Шуурхай хүсэлтүүд */}
          <h3
            style={{
              color: "var(--accent-urgent)",
              marginBottom: "0.8rem",
              fontSize: "1.1rem",
            }}
          >
            ⚡ Шуурхай зарын хүсэлтүүд (төлбөр шалгах)
          </h3>
          <div
            className="table-wrap"
            style={{ overflowX: "auto", marginBottom: "2rem" }}
          >
            <table className="admin-table" style={tableStyle}>
              <thead>
                <tr
                  style={{
                    background: "rgba(255, 45, 107, 0.15)",
                    color: "var(--accent-urgent)",
                    borderBottom: "2px solid var(--border-color)",
                  }}
                >
                  <th style={thStyle}>Зар</th>
                  <th style={thStyle}>Хэрэглэгч</th>
                  <th style={thStyle}>Төлсөн тайлбар</th>
                  <th style={thStyle}>Баримт</th>
                  <th style={thStyle}>Төлөв</th>
                  <th style={thStyle}>Үйлдэл</th>
                </tr>
              </thead>
              <tbody id="adminUrgentTable" />
            </table>
          </div>

          {/* Заруудын Удирдлага */}
          <h3
            style={{
              color: "var(--primary)",
              marginBottom: "0.8rem",
              fontSize: "1.1rem",
            }}
          >
            📌 Заруудын Хяналт &amp; Төлөв
          </h3>
          <div
            className="table-wrap"
            style={{ overflowX: "auto", marginBottom: "2rem" }}
          >
            <table className="admin-table" style={tableStyle}>
              <thead>
                <tr
                  style={{
                    background: "rgba(255, 122, 48, 0.12)",
                    color: "var(--primary)",
                    borderBottom: "2px solid var(--border-color)",
                  }}
                >
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Гарчиг</th>
                  <th style={thStyle}>Эзэмшигч</th>
                  <th style={thStyle}>Төлөв</th>
                  <th style={thStyle}>Үйлдэл</th>
                </tr>
              </thead>
              <tbody id="adminListingsTable" />
            </table>
          </div>

          {/* Хэрэглэгчдийн Удирдлага */}
          <h3
            style={{
              color: "var(--primary)",
              marginBottom: "0.8rem",
              fontSize: "1.1rem",
            }}
          >
            👥 Хэрэглэгчдийн Бүртгэл
          </h3>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="admin-table" style={tableStyle}>
              <thead>
                <tr
                  style={{
                    background: "rgba(255, 122, 48, 0.12)",
                    color: "var(--primary)",
                    borderBottom: "2px solid var(--border-color)",
                  }}
                >
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Username</th>
                  <th style={thStyle}>Gmail</th>
                  <th style={thStyle}>Эрх</th>
                  <th style={thStyle}>Шуурхай Эрх</th>
                  <th style={thStyle}>Үйлдэл</th>
                </tr>
              </thead>
              <tbody id="adminUsersTable" />
            </table>
          </div>
        </div>
      </div>

      {/* ШУУРХАЙ ЗАР ТАВИХ ХҮСЭЛТ MODAL */}
      <div className="modal" id="urgentModal" style={{ display: "none" }}>
        <div className="modal-content">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h3 className="modal-title urgent-title">
            ⚡ Шуурхай зар тавих хүсэлт
          </h3>

          <form id="urgentForm">
            <div className="form-group">
              <label htmlFor="urgentListingSelect">Шуурхай болгох зар:</label>
              <select id="urgentListingSelect" required />
            </div>

            <div className="contact-card">
              <h4>💳 Төлбөр төлөх данс:</h4>
              <p>
                Банк: <span className="contact-highlight">Хаан Банк</span>
              </p>
              <p>
                Данс:{" "}
                <span className="contact-highlight" id="urgentAccountNo">
                  5726062671
                </span>
              </p>
              <p>
                Нэр:{" "}
                <span className="contact-highlight">Bat-Erdene Otgonbayar</span>
              </p>
              <p id="urgentFeeLine" />
              <p>
                Гүйлгээний утга:{" "}
                <span className="contact-highlight" id="urgentRefCode" />
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="urgentPayerNote">
                Төлбөр төлсөн хүний нэр / тайлбар:
              </label>
              <input
                type="text"
                id="urgentPayerNote"
                placeholder="Жишээ: Б.Болд, 15:20 цагт шилжүүлсэн"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="urgentReceiptFile">
                Гүйлгээний баримт (зураг):
              </label>
              <input
                type="file"
                id="urgentReceiptFile"
                accept="image/*"
                required
              />
            </div>

            <button type="submit" className="btn btn-urgent btn-full">
              📨 Админд хүсэлт илгээх
            </button>
            <p style={hintStyle}>
              Төлбөрөө шилжүүлсний дараа хүсэлтээ илгээнэ үү. Админ шалгаж
              баталгаажуулсны дараа таны зар ШУУРХАЙ болно.
            </p>
          </form>
        </div>
      </div>

      {/* НЭВТРЭХ MODAL */}
      <div className="modal" id="loginModal" style={{ display: "none" }}>
        <div className="modal-content">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h3 className="modal-title">Нэвтрэх</h3>
          <form id="loginForm">
            <div className="form-group">
              <label htmlFor="loginEmail">И-мэйл:</label>
              <input
                type="email"
                id="loginEmail"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="loginPassword">Нууц үг:</label>
              <input
                type="password"
                id="loginPassword"
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              Нэвтрэх
            </button>
          </form>
        </div>
      </div>

      {/* БҮРТГҮҮЛЭХ MODAL */}
      <div className="modal" id="registerModal" style={{ display: "none" }}>
        <div className="modal-content">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h3 className="modal-title">Бүртгүүлэх</h3>
          <form id="registerForm">
            <div className="form-group">
              <label htmlFor="regUsername">
                Username (Хэрэглэгчийн нэр):
              </label>
              <input
                type="text"
                id="regUsername"
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="regEmail">И-мэйл (Gmail):</label>
              <input
                type="email"
                id="regEmail"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="regPassword">Нууц үг:</label>
              <input
                type="password"
                id="regPassword"
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="submit"
              id="regSubmitBtn"
              className="btn btn-success btn-full"
            >
              Бүртгүүлэх
            </button>
          </form>
        </div>
      </div>

      {/* АПП СУУЛГАХ ЗААВАР MODAL (Android / iPhone тус тусдаа) */}
      <div className="modal" id="installModal" style={{ display: "none" }}>
        <div className="modal-content">
          <span className="close-btn" onClick={closeModals}>
            ×
          </span>
          <h3 className="modal-title">📲 Аппликейшн болгон суулгах</h3>

          <div className="install-tabs">
            <button
              type="button"
              className="tab-btn install-tab-btn active"
              data-platform="android"
              onClick={callOnThis("switchInstallTab", "android")}
            >
              🤖 Android
            </button>
            <button
              type="button"
              className="tab-btn install-tab-btn"
              data-platform="ios"
              onClick={callOnThis("switchInstallTab", "ios")}
            >
              🍏 iPhone
            </button>
          </div>

          <div id="installStepsAndroid" className="install-steps">
            <ol>
              <li>
                Доорх <b>"Суулгах"</b> товчийг дарна уу.
              </li>
              <li>
                Гарч ирэх цонхноос <b>"Install" / "Суулгах"</b> дээр дарж
                баталгаажуулна уу.
              </li>
              <li>
                Хэрэв товч харагдахгүй бол Chrome цэс (⋮) →{" "}
                <b>"Add to Home screen" / "Нүүр хуудас руу нэмэх"</b> сонгоно
                уу.
              </li>
            </ol>
            <button
              type="button"
              className="btn btn-success btn-full"
              onClick={call("triggerAndroidInstall")}
            >
              ⬇️ Суулгах
            </button>
            <p id="androidInstallHint" style={hintStyle} />
          </div>

          <div
            id="installStepsIOS"
            className="install-steps"
            style={{ display: "none" }}
          >
            <ol>
              <li>
                Энэ хуудсыг <b>Safari</b> хөтчөөр нээнэ үү (Chrome/бусад апп
                дээр ажиллахгүй).
              </li>
              <li>
                Доод (эсвэл дээд) хэсгийн <b>Хуваалцах</b> товч <b>⬆️⎘</b> дарна
                уу.
              </li>
              <li>
                Жагсаалтаас доош гүйлгэж{" "}
                <b>"Add to Home Screen" / "Нүүр хуудас руу нэмэх"</b> сонгоно
                уу.
              </li>
              <li>
                Баруун дээд буланд <b>"Add" / "Нэмэх"</b> товч дарж
                баталгаажуулна уу.
              </li>
            </ol>
            <p style={hintStyle}>
              Суулгасны дараа апп таны нүүр хуудсан дээр лого хэлбэрээр гарч
              ирнэ.
            </p>
          </div>
        </div>
      </div>

      <footer>
        <p>© 2026 Account Hudaldaa - Account Худалдаа</p>
      </footer>
    </>
  );
}