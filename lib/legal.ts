/**
 * Privacy Policy & Terms content, kept out of the i18n locale files because of
 * its length. Authored in English + Turkish (the primary audiences); other
 * locales fall back to English. This is a good-faith template reflecting the
 * app's actual data usage — it is NOT legal advice; have it reviewed before
 * relying on it for compliance.
 */

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

const CONTACT = "emreerden@pm.me";
// Update when the policy text changes.
export const LEGAL_UPDATED = "2026-10-10";

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  updated: LEGAL_UPDATED,
  intro:
    "This policy explains what data Resource Base collects, why, and your rights over it. We aim to collect as little as possible. It is written to align with the GDPR (EU) and KVKK (Türkiye).",
  sections: [
    {
      heading: "Who we are",
      body: [
        `Resource Base is a curated directory of companies (with how to apply to them) and resources. For privacy questions, contact us at ${CONTACT}.`,
      ],
    },
    {
      heading: "What we collect",
      body: [
        "Account data (only if you sign in): your email address, and a profile (username, display name, optional bio, avatar and social links) stored in our database hosted on Cloudflare.",
        "Activity data: resources you favorite, companies you save to your application tracker (with the status and private notes you set — visible only to you), and resources/edits you submit for review. Aggregate, anonymous click counts per resource (not tied to your identity).",
        "Technical data: standard server logs and, if you consent, anonymous usage analytics (page views, performance). We do not sell your data.",
      ],
    },
    {
      heading: "Why we use it",
      body: [
        "To provide the service: authentication, your favorites, your application tracker, your submissions and their review status, and contributor attribution on public profiles.",
        "To improve the site via aggregate analytics (only with your consent).",
        "Legal basis: performance of the service you request (account features) and your consent (analytics cookies).",
      ],
    },
    {
      heading: "Cookies & analytics",
      body: [
        "Essential cookies keep you signed in. We load Google Analytics only after you accept analytics in the cookie banner; if you decline, no analytics scripts or cookies are set. We also use Cloudflare Web Analytics, which is privacy-first and cookieless.",
        "You can change your choice any time by clearing the site's cookies/localStorage.",
      ],
    },
    {
      heading: "Email visibility",
      body: [
        "Your email is private by default. It is only shown on your public profile if you explicitly enable “Show email” in your profile settings, and can be turned off at any time.",
      ],
    },
    {
      heading: "Third parties",
      body: [
        "We rely on: Cloudflare (hosting, database, authentication & user data, analytics), Sanity (content), and Google (Analytics, favicon images). These providers process data on our behalf under their own terms.",
      ],
    },
    {
      heading: "Data retention",
      body: [
        "We keep your account data until you delete your account. Aggregate click counts are retained indefinitely as they are anonymous.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can access, export, correct or delete your data. Edit your profile any time. Export a copy of your data, or permanently delete your account and associated data, from your profile settings. Under GDPR/KVKK you may also lodge a complaint with your local authority.",
        `For any request, contact ${CONTACT}.`,
      ],
    },
    {
      heading: "Changes",
      body: [
        "We may update this policy; the “last updated” date above reflects the latest version.",
      ],
    },
  ],
};

const privacyTr: LegalDoc = {
  title: "Gizlilik Politikası",
  updated: LEGAL_UPDATED,
  intro:
    "Bu politika, Resource Base'in hangi verileri neden topladığını ve bu veriler üzerindeki haklarınızı açıklar. Mümkün olduğunca az veri toplamayı hedefliyoruz. GDPR (AB) ve KVKK (Türkiye) ile uyumlu olacak şekilde yazılmıştır.",
  sections: [
    {
      heading: "Biz kimiz",
      body: [
        `Resource Base, özenle seçilmiş bir şirket (başvuru bilgileriyle birlikte) ve kaynak dizinidir. Gizlilik soruları için ${CONTACT} adresinden bize ulaşın.`,
      ],
    },
    {
      heading: "Topladığımız veriler",
      body: [
        "Hesap verileri (yalnızca giriş yaparsanız): e-posta adresiniz ve bir profil (kullanıcı adı, görünen ad, isteğe bağlı biyografi, avatar ve sosyal bağlantılar) — Cloudflare üzerinde barındırılan veritabanımızda saklanır.",
        "Etkinlik verileri: favorilediğiniz kaynaklar, başvuru takibinize eklediğiniz şirketler (belirlediğiniz durum ve yalnızca sizin görebildiğiniz özel notlarla) ve incelenmek üzere gönderdiğiniz kaynak/düzenleme önerileri. Kaynak başına toplu, anonim tıklanma sayıları (kimliğinizle ilişkilendirilmez).",
        "Teknik veriler: standart sunucu kayıtları ve onay verirseniz anonim kullanım analitiği (sayfa görüntüleme, performans). Verilerinizi satmıyoruz.",
      ],
    },
    {
      heading: "Neden kullanıyoruz",
      body: [
        "Hizmeti sunmak için: kimlik doğrulama, favorileriniz, başvuru takibiniz, gönderileriniz ve inceleme durumları, ve herkese açık profillerde katkı atfı.",
        "Toplu analitik ile siteyi iyileştirmek için (yalnızca onayınızla).",
        "Hukuki dayanak: talep ettiğiniz hizmetin ifası (hesap özellikleri) ve açık rızanız (analitik çerezler).",
      ],
    },
    {
      heading: "Çerezler ve analitik",
      body: [
        "Zorunlu çerezler oturumunuzu açık tutar. Google Analytics yalnızca çerez bildirimindeki analitiği kabul ettikten sonra yüklenir; reddederseniz hiçbir analitik betiği veya çerezi çalışmaz. Ayrıca gizlilik-öncelikli ve çerezsiz olan Cloudflare Web Analytics kullanırız.",
        "Sitenin çerezlerini/localStorage'ını temizleyerek tercihinizi istediğiniz zaman değiştirebilirsiniz.",
      ],
    },
    {
      heading: "E-posta görünürlüğü",
      body: [
        "E-postanız varsayılan olarak gizlidir. Yalnızca profil ayarlarınızdan “E-postayı göster” seçeneğini açıkça etkinleştirirseniz herkese açık profilinizde görünür ve istediğiniz zaman kapatabilirsiniz.",
      ],
    },
    {
      heading: "Üçüncü taraflar",
      body: [
        "Şunlara güveniyoruz: Cloudflare (barındırma, veritabanı, kimlik doğrulama ve kullanıcı verisi, analitik), Sanity (içerik), Google (Analytics, favicon görselleri). Bu sağlayıcılar bizim adımıza kendi şartları kapsamında veri işler.",
      ],
    },
    {
      heading: "Veri saklama",
      body: [
        "Hesap verilerinizi siz hesabınızı silene kadar saklarız. Toplu tıklanma sayıları anonim olduğundan süresiz saklanır.",
      ],
    },
    {
      heading: "Haklarınız",
      body: [
        "Verilerinize erişebilir, dışa aktarabilir, düzeltebilir veya silebilirsiniz. Profilinizi istediğiniz zaman düzenleyebilir; profil ayarlarınızdan verilerinizin bir kopyasını dışa aktarabilir veya hesabınızı ve ilişkili verileri kalıcı olarak silebilirsiniz. GDPR/KVKK kapsamında yerel otoriteye şikâyette de bulunabilirsiniz.",
        `Her türlü talep için ${CONTACT} ile iletişime geçin.`,
      ],
    },
    {
      heading: "Değişiklikler",
      body: [
        "Bu politikayı güncelleyebiliriz; yukarıdaki “son güncelleme” tarihi en son sürümü yansıtır.",
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  title: "Terms of Service",
  updated: LEGAL_UPDATED,
  intro:
    "By using Resource Base you agree to these terms. Please read them carefully.",
  sections: [
    {
      heading: "The service",
      body: [
        "Resource Base is a free, curated directory of links to third-party resources and of companies with their publicly available application channels. We do not own or control those external sites and are not responsible for their content or availability.",
        "Company information (emails, career pages, locations) is community-curated from public sources and may be outdated. We are not affiliated with the listed companies, and listing a company does not mean it is currently hiring. Companies can ask for corrections or removal at any time.",
      ],
    },
    {
      heading: "Accounts",
      body: [
        "You are responsible for activity under your account. Provide accurate information and keep your credentials secure. You must be able to form a binding contract to create an account.",
      ],
    },
    {
      heading: "Submissions",
      body: [
        "When you submit a resource or an edit, you confirm you have the right to share it and grant us a non-exclusive license to display it in the directory. Submissions are reviewed and may be edited or rejected. Do not submit illegal, infringing, malicious or spam content.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "Do not abuse, scrape excessively, attempt to break security, or disrupt the service. We may rate-limit, suspend or remove accounts that violate these terms.",
      ],
    },
    {
      heading: "Disclaimer & liability",
      body: [
        "The service is provided “as is” without warranties. To the extent permitted by law, we are not liable for damages arising from use of the service or reliance on listed resources.",
      ],
    },
    {
      heading: "Changes & contact",
      body: [
        `We may update these terms; continued use means acceptance. Questions: ${CONTACT}.`,
      ],
    },
  ],
};

const termsTr: LegalDoc = {
  title: "Kullanım Şartları",
  updated: LEGAL_UPDATED,
  intro:
    "Resource Base'i kullanarak bu şartları kabul etmiş olursunuz. Lütfen dikkatle okuyun.",
  sections: [
    {
      heading: "Hizmet",
      body: [
        "Resource Base, üçüncü taraf kaynaklara bağlantılar ve şirketlerin herkese açık başvuru kanallarını içeren ücretsiz, özenle seçilmiş bir dizindir. Bu harici sitelerin sahibi veya kontrolcüsü değiliz; içeriklerinden veya erişilebilirliklerinden sorumlu değiliz.",
        "Şirket bilgileri (e-postalar, kariyer sayfaları, konumlar) herkese açık kaynaklardan derlenir ve güncelliğini yitirmiş olabilir. Listelenen şirketlerle bir bağlantımız yoktur; bir şirketin listede olması aktif olarak işe alım yaptığı anlamına gelmez. Şirketler her zaman düzeltme veya kaldırma talep edebilir.",
      ],
    },
    {
      heading: "Hesaplar",
      body: [
        "Hesabınız altındaki etkinliklerden siz sorumlusunuz. Doğru bilgi verin ve kimlik bilgilerinizi güvende tutun. Hesap oluşturmak için bağlayıcı bir sözleşme yapma ehliyetine sahip olmalısınız.",
      ],
    },
    {
      heading: "Gönderiler",
      body: [
        "Bir kaynak veya düzenleme gönderdiğinizde, bunu paylaşma hakkına sahip olduğunuzu onaylar ve dizinde göstermemiz için bize münhasır olmayan bir lisans verirsiniz. Gönderiler incelenir; düzenlenebilir veya reddedilebilir. Yasa dışı, hak ihlali yapan, kötü amaçlı veya spam içerik göndermeyin.",
      ],
    },
    {
      heading: "Kabul edilebilir kullanım",
      body: [
        "Hizmeti kötüye kullanmayın, aşırı veri kazımayın, güvenliği aşmaya çalışmayın veya hizmeti aksatmayın. Bu şartları ihlal eden hesaplara hız sınırı koyabilir, askıya alabilir veya kaldırabiliriz.",
      ],
    },
    {
      heading: "Sorumluluk reddi",
      body: [
        "Hizmet “olduğu gibi”, garantisiz sunulur. Yasaların izin verdiği ölçüde, hizmetin kullanımından veya listelenen kaynaklara güvenmekten doğan zararlardan sorumlu değiliz.",
      ],
    },
    {
      heading: "Değişiklikler ve iletişim",
      body: [
        `Bu şartları güncelleyebiliriz; kullanmaya devam etmek kabul anlamına gelir. Sorular: ${CONTACT}.`,
      ],
    },
  ],
};

export function getLegalDoc(
  kind: "privacy" | "terms",
  lang: string,
): LegalDoc {
  const tr = lang.startsWith("tr");
  if (kind === "privacy") return tr ? privacyTr : privacyEn;
  return tr ? termsTr : termsEn;
}
