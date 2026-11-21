/* Privacy policy (template — review with your legal adviser before publishing). */
(function () {
  const TEXT = {
    en: `<p class="eyebrow">Legal</p><h1 class="h1">Privacy Policy</h1>
<p class="muted">Last updated: {date}</p>
<p>This policy explains how {company} ("Formica", "we") collects and uses personal data when you use this website.</p>
<h2>What we collect</h2><p>When you send a form or use the preliminary estimate, we receive the details you enter: name, phone / WhatsApp number, email, property type, area, community, the requested service, your message and the estimate parameters. We also record technical data such as the page you came from, advertising campaign tags (UTM) and, if you accept them, analytics cookies (Google Analytics, Google Tag Manager, Meta Pixel).</p>
<h2>Why we use it</h2><p>To contact you about your project, prepare a proposal, manage our relationship with you in our CRM, and measure the effectiveness of our website and advertising.</p>
<h2>Sharing</h2><p>We do not sell your data. We share it only with service providers that help us run the business (CRM, messaging, hosting, analytics and advertising platforms), under their own data-protection terms.</p>
<h2>Retention</h2><p>We keep enquiries for as long as needed to respond and for our legitimate business records, then delete or anonymise them.</p>
<h2>Your rights</h2><p>You can ask us to access, correct or delete your personal data at any time by writing to <a href="mailto:{email}">{email}</a>.</p>
<h2>Contact</h2><p>{company}<br>{address}<br><a href="tel:{phone}">{phone}</a></p>`,
    ru: `<p class="eyebrow">Правовая информация</p><h1 class="h1">Политика конфиденциальности</h1>
<p class="muted">Обновлено: {date}</p>
<p>Эта политика объясняет, как {company} («Formica», «мы») собирает и использует персональные данные при использовании сайта.</p>
<h2>Какие данные мы получаем</h2><p>Когда вы отправляете форму или пользуетесь предварительным расчётом, мы получаем введённые данные: имя, телефон / WhatsApp, email, тип объекта, площадь, район, услугу, сообщение и параметры расчёта. Также фиксируются технические данные: страница перехода, метки рекламных кампаний (UTM) и, при вашем согласии, аналитические cookie (Google Analytics, Google Tag Manager, Meta Pixel).</p>
<h2>Зачем мы их используем</h2><p>Чтобы связаться с вами по проекту, подготовить предложение, вести историю общения в CRM и оценивать эффективность сайта и рекламы.</p>
<h2>Передача данных</h2><p>Мы не продаём ваши данные. Передаём их только сервисам, которые помогают нам работать (CRM, мессенджеры, хостинг, аналитика и рекламные платформы), на их условиях защиты данных.</p>
<h2>Хранение</h2><p>Мы храним заявки столько, сколько нужно для ответа и ведения деловой документации, затем удаляем или обезличиваем их.</p>
<h2>Ваши права</h2><p>Вы можете в любой момент запросить доступ, исправление или удаление ваших данных, написав на <a href="mailto:{email}">{email}</a>.</p>
<h2>Контакты</h2><p>{company}<br>{address}<br><a href="tel:{phone}">{phone}</a></p>`
  };
  window.F.contentPromise.then(c => {
    const s = c.settings, { esc, L, lang } = window.F;
    document.getElementById('privacy').innerHTML = TEXT[lang]
      .replace(/{company}/g, esc(s.company)).replace(/{email}/g, esc(s.email)).replace(/{phone}/g, esc(s.phone))
      .replace(/{address}/g, esc(L(s.address)).replace(/\n/g, '<br>'))
      .replace(/{date}/g, new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { year: 'numeric', month: 'long' }));
  });
})();
