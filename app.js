import { database } from './firebase.js';
import { limitToLast, onValue, push, query, ref, remove, serverTimestamp, set, update } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

const $ = (selector) => document.querySelector(selector); const $$ = (selector) => [...document.querySelectorAll(selector)];
const shop = Boolean($('#shopView'));
const admin = Boolean($('#adminView'));
const fallbackImage = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80';
const BASE_OFFERS = [
  ['pubg', 'PUBG MOBILE', '60 شدة', 35, 50, 'https://images.unsplash.com/photo-1664092815283-19c6196f5319?auto=format&fit=crop&w=900&q=80'],
  ['fc', 'EA SPORTS FC', '500 FC Points', 110, 180, 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=900&q=80'],
  ['ff', 'FREE FIRE', '530 جوهرة', 90, 150, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80'],
  ['ml', 'MOBILE LEGENDS', '86 Diamond', 45, 80, 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80'],
  ['valo', 'VALORANT', '475 VP', 120, 200, 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80'],
  ['roblox', 'ROBLOX', '400 Robux', 135, 220, fallbackImage]
].map(([id, game, name, price, xp, image]) => ({ id, game, name, price, xp, image, symbol: game.slice(0, 2), active: true }));

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const money = (value) => `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;
const objects = (value) => Object.entries(value || {}).map(([id, data]) => ({ id, ...data }));
const usernameKey = (username) => encodeURIComponent(username.trim().toLocaleLowerCase('en-US')).replace(/\./g, '%2E');
const validWhatsapp = (value) => /^\d{8,15}$/.test(String(value || ''));
const safeImage = (value) => { try { const url = new URL(value || fallbackImage, location.href); return /^https?:$/.test(url.protocol) ? url.href.replace(/'/g, '%27') : fallbackImage; } catch { return fallbackImage; } };
const toast = (message) => { const item = $('#toast'); if (!item) return; item.textContent = message; item.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => item.classList.remove('show'), 2800); };
const firebaseError = (error) => ({ 'permission-denied': 'قاعدة البيانات رفضت الإجراء. انشر قواعد الإدارة المباشرة أولاً.' }[error?.code] || 'حصلت مشكلة في الاتصال. جرّب تاني.');
const databaseAccessError = () => toast('Firebase قافل القراءة. انشر database.rules.json على مشروع Firebase أولاً.');

let publicOffers = [];
let publicSettings = { whatsapp: '', siteImage: '' };
let publicBans = {};
let adminState = { offers: [], orders: [], bans: {}, settings: { whatsapp: '', siteImage: '' } };
let adminListeners = [];

function updateMetaImage(url) {
  if (!url) return;
  const ogImg = $('#ogImage');
  const twImg = $('#twitterImage');
  if (ogImg) ogImg.setAttribute('content', url);
  if (twImg) twImg.setAttribute('content', url);
}

function renderShop() {
  const offers = publicOffers.filter((offer) => offer.active !== false).sort((a, b) => String(a.game).localeCompare(String(b.game)));
  $('#offerGrid').innerHTML = offers.map((offer) => `<article class="offer-card"><div class="offer-visual with-image" style="background-image:linear-gradient(0deg,rgba(6,18,13,.55),transparent),url('${safeImage(offer.image)}')"><span class="game-symbol">${esc(offer.symbol || String(offer.game).slice(0, 2))}</span></div><div class="offer-info"><span class="game-name">${esc(offer.game)}</span><h3 class="offer-title">${esc(offer.name)}</h3><div class="offer-bottom"><strong class="price">${money(offer.price)}</strong><button class="order-offer" data-order-offer="${esc(offer.id)}" aria-label="اطلب ${esc(offer.name)}">↙</button></div></div></article>`).join('');
  $('#offersEmpty').hidden = offers.length !== 0;
  $('#offerSelect').innerHTML = `<option value="">اختار العرض المناسب</option>${offers.map((offer) => `<option value="${esc(offer.id)}">${esc(offer.game)} —${esc(offer.name)}</option>`).join('')}`;
  updatePrice();
}

function updatePrice() {
  if (!shop) return;
  const offer = publicOffers.find((item) => item.id === $('#offerSelect').value && item.active !== false);
  $('#orderPrice').textContent = offer ? money(offer.price) : '—';
}

function startShop() {
  onValue(ref(database, 'offers'), (snapshot) => { publicOffers = objects(snapshot.val()); renderShop(); }, databaseAccessError);
  onValue(ref(database, 'settings'), (snapshot) => { 
    publicSettings = { whatsapp: '', siteImage: '', ...(snapshot.val() || {}) };
    if (publicSettings.siteImage) updateMetaImage(publicSettings.siteImage);
  }, () => {});
  onValue(ref(database, 'bannedUsernames'), (snapshot) => { publicBans = snapshot.val() || {}; }, () => {});
  $('#offerSelect').addEventListener('change', updatePrice);
  $('#orderForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $('#username').value.trim();
    const offer = publicOffers.find((item) => item.id === $('#offerSelect').value && item.active !== false);
    if (!offer) return toast('اختار عرض متاح الأول.');
    if (username.length < 3 || username.length > 32) return toast('اسم المستخدم لازم يكون من 3 إلى 32 حرف.');
    if (publicBans[usernameKey(username)]) return toast('المستخدم ده محظور من طلبات الشحن.');
    if (!validWhatsapp(publicSettings.whatsapp)) return toast('رقم واتساب الطلبات لسه مش متضبط.');
    const submit = $('#orderSubmit');
    const popup = window.open('', '_blank');
    submit.disabled = true; submit.textContent = 'جاري تسجيل الطلب...';
    const orderRef = push(ref(database, 'orders'));
    const orderNo = `EG-${String(Date.now()).slice(-8)}`;
    const order = { orderNo, username, usernameKey: usernameKey(username), offerId: offer.id, game: offer.game, offerName: offer.name, price: Number(offer.price), xp: Number(offer.xp), status: 'pending', createdAt: serverTimestamp() };
    try {
      await set(orderRef, order);
      const message = encodeURIComponent(`طلب شحن جديد\nرقم الطلب: ${orderNo}\nالعرض: ${offer.game} — ${offer.name}\nاسم المستخدم: ${username}\nالسعر: ${offer.price} جنيه`);
      const url = `https://wa.me/${publicSettings.whatsapp}?text=${message}`;
      if (popup) { popup.location.href = url; } else { window.open(url, '_blank'); }
      $('#navUser').textContent = username;
      event.target.reset(); updatePrice(); toast(`تم تسجيل طلبك رقم ${orderNo}`);
    } catch (error) {
      popup?.close();
      toast(error?.code === 'PERMISSION_DENIED' ? 'لا يمكن إتمام الطلب لهذا المستخدم.' : firebaseError(error));
    } finally {
      submit.disabled = false; submit.innerHTML = 'أكد وافتح واتساب <b>↙</b>';
    }
  });
  document.addEventListener('click', (event) => {
    const selected = event.target.closest('[data-order-offer]');
    if (selected) { $('#offerSelect').value = selected.dataset.orderOffer; updatePrice(); $('#order').scrollIntoView({ behavior: 'smooth' }); }
    if (event.target.closest('[data-scroll-order]')) $('#order').scrollIntoView({ behavior: 'smooth' });   });   drawStars(); }  function clearAdminListeners() { adminListeners.forEach((unsubscribe) => unsubscribe()); adminListeners = []; } function showPanel(id) {   $$('.admin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === id));$$('.side-link').forEach((link) => link.classList.toggle('active', link.dataset.panel === id));$('#adminTitle').textContent = ({ overview: 'نظرة عامة', offersPanel: 'العروض', ordersPanel: 'الطلبات', usersPanel: 'المستخدمون', settingsPanel: 'الإعدادات' })[id];
}
function statusLabel(status) { return status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'; }
function setEmpty(id, isEmpty) { $(id).hidden = !isEmpty; }
function renderAdmin() {
  const offers = [...adminState.offers].sort((a, b) => String(a.game).localeCompare(String(b.game)));
  const orders = [...adminState.orders].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const completed = orders.filter((order) => order.status === 'completed');
  const completion = orders.length ? Math.round((completed.length / orders.length) * 100) : 0;
  $('#metricOrders').textContent = orders.length; $('#metricPending').textContent = orders.filter((order) => order.status !== 'completed').length; $('#metricXp').textContent = completed.reduce((total, order) => total + Number(order.xp || 0), 0).toLocaleString('ar-EG');
  $('#completionRate').textContent = `${completion}%`; $('.completion-ring').style.setProperty('--percent', `${completion}%`);
  $('#recentOrders').innerHTML = orders.slice(0, 5).map((order) => `<div class="recent-row"><strong>${esc(order.orderNo || order.id)}</strong><span>${esc(order.username)}</span><span>${esc(order.offerName)}</span><b class="status ${esc(order.status)}">${statusLabel(order.status)}</b></div>`).join('') || '<p class="empty">مفيش طلبات لسه.</p>';
  $('#offersTable').innerHTML = offers.map((offer) => `<tr><td><strong>${esc(offer.name)}</strong></td><td>${esc(offer.game)}</td><td>${money(offer.price)}</td><td>+${Number(offer.xp || 0)}</td><td><span class="status ${offer.active === false ? 'pending' : 'completed'}">${offer.active === false ? 'مخفي' : 'متاح'}</span></td><td><button class="action-btn" data-edit="${esc(offer.id)}">تعديل</button><button class="action-btn danger" data-delete-offer="${esc(offer.id)}">حذف</button></td></tr>`).join('');
  setEmpty('#offersAdminEmpty', offers.length === 0);
  const filter = $('#orderStatusFilter').value;
  const shown = filter === 'all' ? orders : orders.filter((order) => order.status === filter);
  $('#ordersTable').innerHTML = shown.map((order) => `<tr><td><strong>${esc(order.orderNo || order.id)}</strong></td><td>${esc(order.username)}</td><td>${esc(order.offerName)}</td><td>+${Number(order.xp || 0)}</td><td><span class="status ${esc(order.status)}">${statusLabel(order.status)}</span></td><td><button class="action-btn" data-toggle-order="${esc(order.id)}">${order.status === 'completed' ? 'رجّعه للتنفيذ' : 'حدده كمكتمل'}</button></td></tr>`).join('');
  setEmpty('#ordersEmpty', shown.length === 0);
  const users = new Map();
  orders.forEach((order) => { const user = users.get(order.usernameKey) || { username: order.username, usernameKey: order.usernameKey, orders: 0, xp: 0 }; user.orders += 1; if (order.status === 'completed') user.xp += Number(order.xp || 0); users.set(order.usernameKey, user); });
  $('#usersTable').innerHTML = [...users.values()].map((user) => { const banned = Boolean(adminState.bans[user.usernameKey]); return `<tr><td><strong>${esc(user.username)}</strong></td><td>${user.orders}</td><td>${user.xp.toLocaleString('ar-EG')}</td><td><span class="status ${banned ? 'pending' : 'completed'}">${banned ? 'محظور' : 'نشط'}</span></td><td><button class="action-btn ${banned ? '' : 'danger'}" data-ban-user="${esc(user.usernameKey)}">${banned ? 'إلغاء الحظر' : 'حظر'}</button></td></tr>`; }).join('');
  setEmpty('#usersEmpty', users.size === 0);
  $('#whatsappNumber').value = adminState.settings.whatsapp || '';
  if ($('#siteImageUrl')) {
    $('#siteImageUrl').value = adminState.settings.siteImage || '';
    if (adminState.settings.siteImage) {
      $('#previewImg').src = adminState.settings.siteImage;
      $('#siteImagePreview').style.display = 'block';
    }
  }
}

function startAdminListeners() {
  clearAdminListeners();
  adminListeners.push(onValue(ref(database, 'offers'), (snap) => { adminState.offers = objects(snap.val()); renderAdmin(); }, databaseAccessError));
  adminListeners.push(onValue(query(ref(database, 'orders'), limitToLast(250)), (snap) => { adminState.orders = objects(snap.val()); renderAdmin(); }, databaseAccessError));
  adminListeners.push(onValue(ref(database, 'bannedUsernames'), (snap) => { adminState.bans = snap.val() || {}; renderAdmin(); }, databaseAccessError));
  adminListeners.push(onValue(ref(database, 'settings'), (snap) => { adminState.settings = { whatsapp: '', siteImage: '', ...(snap.val() || {}) }; renderAdmin(); }, databaseAccessError));
}

function openOfferModal(offer) {
  $('#offerModal').hidden = false; $('#modalTitle').textContent = offer ? 'تعديل العرض' : 'عرض جديد'; $('#editOfferId').value = offer?.id || ''; $('#offerName').value = offer?.name \vert{}\vert{} ''; $('#offerGame').value = offer?.game || ''; $('#offerImage').value = offer?.image \vert{}\vert{} ''; $('#offerPrice').value = offer?.price || ''; $('#offerXp').value = offer?.xp \vert{}\vert{} ''; $('#offerActive').checked = offer?.active !== false;
}

function startAdmin() {
  $('#adminDate').textContent = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#settingsForm').addEventListener('submit', async (event) => { event.preventDefault(); const whatsapp = $('#whatsappNumber').value.replace(/\D/g, ''); if (!validWhatsapp(whatsapp)) return toast('اكتب رقم دولي صحيح من 8 إلى 15 رقم.'); try { await update(ref(database, 'settings'), { whatsapp, updatedAt: serverTimestamp() }); toast('اتحفظ رقم واتساب الطلبات.'); } catch (error) { toast(firebaseError(error)); } });
  
  $('#siteImageForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const siteImage = $('#siteImageUrl').value.trim();
    try {
      await update(ref(database, 'settings'), { siteImage, updatedAt: serverTimestamp() });
      toast('تم حفظ صورة الموقع لجرج وجوجل.');
    } catch (error) {
      toast(firebaseError(error));
    }
  });

  $('#siteImageUrl')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val) {
      $('#previewImg').src = val;
      $('#siteImagePreview').style.display = 'block';
    } else {
      $('#siteImagePreview').style.display = 'none';
    }
  });

  $('#seedOffers').addEventListener('click', async () => { if (!confirm('تحميل العروض الأساسية على Firebase؟ العروض الحالية لن تتشال.')) return; const data = Object.fromEntries(BASE_OFFERS.map((offer) => [offer.id, { ...offer, updatedAt: serverTimestamp() }])); try { await update(ref(database, 'offers'), data); toast('تم تحميل العروض الأساسية.'); } catch (error) { toast(firebaseError(error)); } });
  $('#orderStatusFilter').addEventListener('change', renderAdmin);
  $('#offerForm').addEventListener('submit', async (event) => { event.preventDefault(); const id = $('#editOfferId').value || push(ref(database, 'offers')).key; const old = adminState.offers.find((offer) => offer.id === id); const offer = { id, name: $('#offerName').value.trim(), game: $('#offerGame').value.trim(), image: safeImage($('#offerImage').value), price: Number($('#offerPrice').value), xp: Number($('#offerXp').value), active: $('#offerActive').checked, symbol: ($('#offerGame').value.trim().slice(0, 2) || 'GM').toUpperCase(), createdAt: old?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }; try { await set(ref(database, `offers/${id}`), offer); $('#offerModal').hidden = true; toast(old ? 'تم تعديل العرض.' : 'تمت إضافة العرض.'); } catch (error) { toast(firebaseError(error)); } });
  document.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-panel]'); if (tab) showPanel(tab.dataset.panel);
    const target = event.target.closest('[data-panel-trigger]'); if (target) showPanel(target.dataset.panelTrigger);
    if (event.target.closest('#addOfferBtn')) openOfferModal();
    if (event.target.closest('[data-close-modal]')) $('#offerModal').hidden = true;
    const edit = event.target.closest('[data-edit]'); if (edit) openOfferModal(adminState.offers.find((offer) => offer.id === edit.dataset.edit));
    const del = event.target.closest('[data-delete-offer]'); if (del && confirm('تحذف العرض ده من المتجر؟')) { try { await remove(ref(database, `offers/${del.dataset.deleteOffer}`)); toast('تم حذف العرض.'); } catch (error) { toast(firebaseError(error)); } }
    const toggle = event.target.closest('[data-toggle-order]'); if (toggle) { const order = adminState.orders.find((item) => item.id === toggle.dataset.toggleOrder); if (!order) return; const next = order.status === 'completed' ? 'pending' : 'completed'; try { await update(ref(database, `orders/${order.id}`), { status: next, completedAt: next === 'completed' ? serverTimestamp() : null }); toast(next === 'completed' ? `اكتمل الطلب واتضاف ${order.xp} XP.` : 'رجعنا الطلب لقيد التنفيذ.'); } catch (error) { toast(firebaseError(error)); } }
    const ban = event.target.closest('[data-ban-user]'); if (ban) { const key = ban.dataset.banUser; const isBanned = Boolean(adminState.bans[key]); const label = isBanned ? 'إلغاء حظر المستخدم ده؟' : 'حظر المستخدم ده من أي طلب جديد؟'; if (!confirm(label)) return; try { if (isBanned) await remove(ref(database, `bannedUsernames/${key}`)); else await set(ref(database, `bannedUsernames/${key}`), true); toast(isBanned ? 'تم إلغاء الحظر.' : 'تم حظر المستخدم.'); } catch (error) { toast(firebaseError(error)); } }
  });
  $('#adminUserName').textContent = 'إدارة LEVELUP';
  showPanel('overview');
  startAdminListeners();
}

function drawStars() {
  const canvas = $('#starfield'); if (!canvas) return;
  const context = canvas.getContext('2d'); const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + 0.2, v: Math.random() * 0.18 + 0.03 }));
  const draw = () => { canvas.width = innerWidth; canvas.height = innerHeight; context.clearRect(0, 0, canvas.width, canvas.height); stars.forEach((star) => { star.y -= star.v; if (star.y < 0) { star.y = innerHeight; star.x = Math.random() * innerWidth; } context.fillStyle = 'rgba(207,255,102,.65)'; context.beginPath(); context.arc(star.x, star.y, star.r, 0, 7); context.fill(); }); requestAnimationFrame(draw); }; draw();
}

if (shop) startShop();
if (admin) startAdmin();
