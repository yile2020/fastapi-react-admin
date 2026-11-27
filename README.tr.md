<div align="center">

<img src="./apps/web/public/favicon.svg" width="88" alt="fastapi-react-admin">

# fastapi-react-admin

[English](./README.md) | [简体中文](./README.zh-CN.md) | **Türkçe**

**Kullanıma hazır kapsamlı bir yönetim paneli temeli · FastAPI + React 19 + shadcn/ui**

Satır düzeyinde izinler · durumunu koruyan çoklu sekme · onay iş akışı · yetkisini aşamayan yapay zekâ asistanı · devam ettirilebilir yüklemelerle S3 depolama · web, masaüstü ve mobil

[Canlı demo](https://fra.wubunan.com/sign-in) · [Belgeler](https://yile2020.github.io/fastapi-react-admin/en/) · [DeepWiki proje rehberi](https://deepwiki.com/yile2020/fastapi-react-admin) · [Hızlı başlangıç](#hızlı-başlangıç) · [Özellikler](#özellikler) · [Sürümler](https://github.com/yile2020/fastapi-react-admin/releases)

[![Release](https://img.shields.io/github/v/release/yile2020/fastapi-react-admin?style=flat-square)](https://github.com/yile2020/fastapi-react-admin/releases)
[![CI](https://github.com/yile2020/fastapi-react-admin/actions/workflows/ci.yml/badge.svg)](https://github.com/yile2020/fastapi-react-admin/actions/workflows/ci.yml)
[![E2E report](https://img.shields.io/badge/E2E_report-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://yile2020.github.io/fastapi-react-admin/e2e/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/yile2020/fastapi-react-admin)
[![Ask DeepWiki](https://img.shields.io/badge/DeepWiki-yile2020%2Ffastapi--react--admin-blue?style=flat-square&logo=readthedocs&logoColor=white)](https://deepwiki.com/yile2020/fastapi-react-admin)

</div>

> 🚀 Demo hesabı `admin` / `123456` — herkesin giriş yapabileceği herkese açık bir örnektir; veriler diğer ziyaretçiler tarafından değiştirilebilir veya silinebilir, bu nedenle gerçek bir bilgi saklamayın.

<table>
<tr>
<td width="50%"><img src="./docs/screenshots/dashboard.png" alt="Dashboard"></td>
<td width="50%"><img src="./docs/screenshots/dept.png" alt="Departments"></td>
</tr>
<tr>
<td width="50%"><img src="./docs/screenshots/role.png" alt="Roles: permission matrix"></td>
<td width="50%"><img src="./docs/screenshots/data-permission.png" alt="Row-level data permissions"></td>
</tr>
<tr>
<td width="50%"><img src="./docs/screenshots/workflow-inbox.png" alt="Approval inbox"></td>
<td width="50%"><img src="./docs/screenshots/workflow-designer.png" alt="Approval designer"></td>
</tr>
</table>

## 🌱 Neden geliştirildi?

**Üzerine doğrudan iş mantığı yazmaya başlayabileceğiniz bir temele damıtılmış tek bir yeniden yazım.**

Yapay zekâ kod yazmayı hızlandırdı ve bu nedenle geliştirilecek daha fazla sistem var: yol haritasına hiç girememiş küçük araçlar artık yapılmaya değer ve yıllardır çalışan sistemlerin yenilenme zamanı geldi. Yine de her yeni sistemin ilk haftaları aynı listeye gidiyor — oturum açma, izinler, organizasyon yapısı, onaylar, dosyalar, bildirimler.

Bu proje iş yerindeki birkaç küçük Java + Vue 2 sisteminin yeniden yazımı olarak başladı. Eski mimariyi yamalamak yerine onları FastAPI + React 19 üzerinde yeniden kurduk ve her seferinde baştan yazılan her şeyi tek bir temele damıttık. **Bir sonraki sistem doğrudan iş mantığıyla başlar.**

### Web, masaüstü ve mobil için tek depo

Arka uç, web yönetim konsolu, masaüstü şablonu, mobil şablonu ve dokümantasyon sitesi tek bir pnpm + turbo monorepo'sunda yaşar: bir kez kurun ve tek bir `pnpm dev` komutu arka uç ile ön ucu başlatır.

Bu en çok yapay zekâ ile kodlarken karşılığını verir: bir API'yi değiştirdiğinde, arka uç, üretilen ön uç/arka uç sözleşmesi ve onu çağıran sayfaların tamamı görüş alanındadır, bu nedenle değişiklik tek bir PR'da iner; ardından CI bu PR üzerinde depo çapında tip kontrollerini, sözleşme güncelliği kontrolünü ve mimari kontrolünü (`i18n ← ui ← platform ← web` bağımlılık yönü) çalıştırır.

```
apps/
├── api        arka uç · FastAPI + Celery
├── web        web yönetim konsolu · React 19
├── desktop    masaüstü şablonu · Electron
├── mobile     mobil şablonu · Expo / React Native
└── docs       dokümantasyon sitesi · Astro
packages/      tek yönlü bağımlılıklar: i18n / api ← ui ← platform ← web
├── api        OpenAPI'den üretilen ön uç/arka uç tip sözleşmesi
├── i18n       Çince / İngilizce metinler
├── ui         bileşen kütüphanesi, iş mantığı içermez, bütün olarak taşınabilir
└── platform   izinler, çoklu sekme, iş sayfaları
```

- **Web yönetim konsolu** çekirdektir, kullanıma hazırdır
- **Masaüstü şablonu** web derlemesini yükler ve yalnızca bir tarayıcının yapamadıklarını ekler: sessiz yazdırma, yerel donanım, otomatik güncelleme
- **Mobil şablonu** yerel ekranlara sahiptir ve API tipleri ile çevirileri web ile paylaşır
- **Katmanlama zorunlu tutulur**: bağımlılıklar tek yönde akar ve CI içinde `pnpm arch:check` bunu kontrol eder

### Yapay zekâ ile çalışmak için tasarlandı

Yapay zekâ kodu hızlı değiştirir, bu nedenle her değişikliğin onu yakalayacak bir şeye ihtiyacı vardır:

- **Testler** — her CI çalıştırmasında gerçek bir veritabanına ve gerçek bir tarayıcıya karşı mock olmadan 1.600+ test; [E2E raporu](https://yile2020.github.io/fastapi-react-admin/e2e/) herkese açıktır
- **Tipler** — ön uç/arka uç sözleşmesi OpenAPI'den üretilir; mobil her isteğin tiplerini buradan çıkarır, bu nedenle ekranların takip etmediği bir API değişikliği tip kontrolünde başarısız olur (web istemcisi hâlâ geçiş aşamasındadır ve çağrı noktaları şu anda yanıt tiplerini elle bildirmektedir)
- **Yapay zekâ için yazılmış kurallar** — dizin başına 50+ `CLAUDE.md` / `AGENTS.md` dosyası testlerle bulunan tuzakları kaydeder; bir kodlama asistanı düzenlediği dizin için olanını okur
- **Yapay zekâ ekosistemi içinde bir arka uç** — pydantic-ai üzerinde yerleşik yapay zekâ asistanıyla Python + FastAPI

## ✨ Neden bu proje

- **Hangi satırları gördüğünüze kadar inen izinler** — menü ve düğmelerin ötesinde veri kapsamları vardır: aynı kullanıcı tablosunda bir departman yöneticisi yalnızca kendi departmanını görür. Kurallar model sütunlarında yaşar ve bir kural yanlış yapılandırıldığında UI sizi uyarır
- **Durumunu koruyan sekmeler** — React 19'un `<Activity>` bileşeni üzerine kuruludur: geri döndüğünüzde yarı doldurulmuş bir form, bulunduğunuz sayfa, genişletilmiş bir ağaç hâlâ oradadır; görünüm durumu URL'de yaşar, bu nedenle sayfa yenileme de onu kaybetmez
- **Kutudan çıktığı gibi onay iş akışı** — veya-imza / birlikte-imza, geri gönderme, onaylayıcı ekleme, geri alma ve zaman aşımlarıyla Feishu tarzı bir form tasarımcısı ve akış ağacı
- **Yetkisini aşamayan bir yapay zekâ asistanı** — tam olarak oturum açmış kullanıcının yapabildiklerini yapabilir; yazma eylemleri önizlenir ve yalnızca kullanıcı onayladıktan sonra çalışır ve her çağrı denetlenir. Haricî sistemler aynı araçlara bir MCP ağ geçidi üzerinden ulaşabilir
- **Büyük dosyalar kontrol altında** — yerel disk veya S3 uyumlu depolama, hash ile anında yükleme, paralel parçalar, sayfa yenilendikten sonra devam etme ve devam eden her şey için tek bir yükleme tepsisi
- **Veritabanınızı seçin** — PostgreSQL, SQL Server veya MySQL, aynı kod
- **Tarayıcının ötesinde** — bir Electron masaüstü uygulaması (otomatik güncellemeli üç platform için yükleyiciler) ve yerel bir mobil uygulama
- **Varsayılan olarak güvenli, performansı ölçülmüş** — kaba kuvvet saldırısına dayanıklı oturum açma, arka uçta izin ve veri kapsamı kontrolleri, kurcalamaya karşı korumalı denetim kayıtları, başlangıçta zayıf üretim gizli anahtarlarının reddedilmesi;
  test koşulları ve betiği yayınlanmış olarak varsayılan 2 worker üzerinde yaklaşık 70 ms p95 ile yaklaşık 190 istek/sn (bkz. [Güvenlik ve performans](#güvenlik-ve-performans))
- **Gerçek ortamda test edildi** — gerçek veritabanlarına ve gerçek bir tarayıcıya karşı 1.600+ test; CI tam arka uç paketini hem PostgreSQL hem de SQL Server üzerinde çalıştırır

## Karşılaştırma

| | Tipik şablon | Burada |
|---|---|---|
| **İzin ayrıntı düzeyi** | menüler + düğmeler | menüler + düğmeler + **veri kapsamları** — hangi **satırları** gördüğünüzü rol belirler |
| **Çoklu sekme** | Vue'nun `keep-alive` özelliğiyle ücretsizdir; çoğu React şablonunda yoktur veya sekme değiştirdiğinizde durumu kaybeder | React 19 **`<Activity>`**: açık sekmeler bağlı kalır, DOM ve durum geçişte korunur |
| **Bileşen tabanı** | çoğu hâlâ shadcn'in eski Radix sürümündedir | hâlihazırda shadcn'in geçerli varsayılanı olan **Base UI** üzerindedir (sıfır `@radix-ui` içe aktarımı), ayrıca kod kopyalayabileceğiniz bir bileşen korumalı alanı sunar |
| **Veritabanı** | genellikle yalnızca bir tane | **üçünden birini seçin**: PostgreSQL (varsayılan) · SQL Server · MySQL |
| **İş özellikleri** | kullanıcılar / roller / menüler | ayrıca onay iş akışı, yapay zekâ asistanı, açık API, dosyalar ve depolama, mesajlaşma ve zamanlanmış işler |
| **Testler** | çoğunlukla yok veya mock'larla bileşen birim testleri | **mock olmadan gerçek bağımlılıklara karşı** 1.400+ arka uç + 150+ uçtan uca tarayıcı testi |

## Özellikler

| Alan | Neler elde edersiniz |
|---|---|
| **Erişim ve organizasyon** | RBAC (menüler / düğmeler / veri kapsamları) · satır düzeyinde veri izinleri · departman ağacı · kullanıcılar ve roller |
| **İçe ve dışa aktarma** | sunucu tarafında xlsx / csv dışa aktarma (geçerli filtre veya seçili satırlar · büyük dışa aktarmalar arka planda çalışır ve bittiğinde sizi bilgilendirir · formül enjeksiyonuna karşı güvenli) · genel içe aktarma (açılır listeli şablonlar · önizleme ve doğrulama · yalnızca ekle / ekle-güncelle / yalnızca güncelle · hata raporu · ya hep ya hiç) · tek bir dosyadan tüm departman ağacını oluşturma |
| **Oturum açma ve güvenlik** | captcha · kilitleme · parola geçmişi ve süresi · SMS koduyla oturum açma · iki faktörlü doğrulama (TOTP + kurtarma kodları) · OAuth2 (GitHub / Google) · oturum yönetimi (boşta kalma zaman aşımı + mutlak sınır · istemci başına oturum sınırları · kullanıcılara neden çıkış yapıldığını söyler · zorla çıkış) |
| **Çalışma alanı** | özelleştirilebilir kontrol paneli (kartlar izne göre görünür · düzen kullanıcı başına sunucuda saklanır) · çoklu sekme (sabitle / sürükle / yeniden yükle) · komut paleti ⌘K · kısayollar · rehberli tur · tema / köşe yarıçapı / sekme stili · kullanıcı başına saat dilimi · Çince ve İngilizce |
| **Dosyalar ve depolama** | önizlemeli dosya yöneticisi (pdf / docx / xlsx / görseller / arşivler) · yerel + S3 uyumlu depolama · ön imzalı indirmeler · geri dönüşüm kutusu · anında yükleme · parçalı ve devam ettirilebilir yüklemeler · herhangi bir sayfa için ek paneli |
| **Onay iş akışı** | form tasarımcısı · akış ağacı (onayla / bilgi / koşullu dallar) · onayla / reddet / aktar / geri gönder / geri al / onaylayıcı ekle · zaman aşımı hatırlatıcıları ve otomatik eylemler · taslaklar · acil · devir · yapay zekâ ön incelemesi / form doldurma / yapay zekâ onay düğümleri |
| **Yapay zekâ asistanı** | tam sayfa sohbet + yan çekmece · izinlere ve veri kapsamlarına bağlı araç çağrıları · yazmalar için önizleme + onay · denetim günlüğü · MCP ağ geçidi |
| **Açık API** | AK/SK imzalı uç noktalar · kapsamlar / IP izin listesi / tekrar oynatma koruması / hız sınırları · çağrı günlükleri · artımlı senkronizasyon · Python / Node / Java SDK'ları · webhook abonelikleri (Standard Webhooks imzaları · yeniden denemeler · teslimat günlüğü · toplu yeniden gönderme) |
| **Mesajlar ve bildirimler** | uygulama içi bildirimler (gerçek zamanlı) · duyurular (zengin metin + ekler · hedef kitleler · zamanlanmış yayınlama · sabitlenmiş / düzey / bitiş süresi · oturum açtıktan sonra onay gerektiren açılır pencere · üst afiş · oturum açma sayfası duyuruları · okuma istatistikleri) · bildirim yönlendirme (e-posta / SMS / Feishu · DingTalk · WeCom grup botları · olay başına politikalar · teslimat günlüğü) · SMS (Alibaba Cloud / Tencent Cloud) |
| **Zamanlanmış işler** | çevrimiçi zamanlama · cron önizlemesi · çalıştırma geçmişi |
| **İşlemler** | ayarlar · sözlükler · oturum açma / işlem günlükleri (gizlenmiş) · veri değişiklik geçmişi (hangi alanı kim, neden neye, ne zaman ve nereden değiştirdi · işlem günlüğüne bağlı) · sunucu ve Redis izleme · yeni sürüm istemi |
| **İstemciler** | Electron masaüstü (üç platform için yükleyiciler · sessiz yazdırma · yerel donanım · otomatik güncelleme) · yerel Expo uygulaması (bir WebView sarmalayıcısı değildir; kapsam aşağıdadır) |
| **Geliştiriciler** | bileşen korumalı alanı (her bileşen ayarlanabilir ve kopyalanıp yapıştırılabilir) · renk paleti · OpenAPI'den üretilen tip güvenli API sözleşmesi |

## Teknoloji yığını

| | |
|---|---|
| **Ön uç** | React 19 · TypeScript 6 · Vite 8 · TanStack Router / Query / Table v9 · Tailwind CSS 4 · shadcn/ui (Base UI) · zustand · Tiptap 3 · i18next |
| **Arka uç** | FastAPI · Pydantic 2 · SQLAlchemy 2 (async) · Alembic · Redis · Celery · Socket.IO · Apache OpenDAL · pydantic-ai |
| **Veritabanları** | PostgreSQL · SQL Server · MySQL |
| **İstemciler** | Electron 42 · Expo 57 / React Native 0.86 |
| **Araçlar** | pnpm + turbo monorepo · uv · ruff · pytest · Playwright · GitHub Actions |

## Mobil uygulama

Expo uygulaması **insanların telefonda gerçekten yaptığı işleri** kapsar ([#224](https://github.com/yile2020/fastapi-react-admin/issues/224)); yönetim konsolu modülleri web'de kalır. Web uygulamasından ayrı olarak sürümlendirilir.

- **Sahip oldukları:** ana sayfa (onaylarım · yapılacaklar) · onaylar (yapılacaklar / tamamlananlar / bilgi verilenler / başlattıklarım · onayla / reddet / geri gönder / aktar / imzalayan ekle · istek başlat · taslaklar · geri gönderme sonrası yeniden gönder · kapatılmış bir isteği yeniden başlat) · duyurular · bildirimler · kullanıcılar · profil (telefon numarası bağla) · sunucu izleme · saat dilimi · SMS koduyla oturum açma · iki faktörlü oturum açma · oturum süresi dolma nedenleri
- **Tasarım gereği yalnızca web:** roller / departmanlar / menüler · dosyalar · işlem ve oturum açma günlükleri · iki faktörlü doğrulamayı açma · onaylarda yapay zekâ form doldurma ve yapay zekâ ön incelemesi
- **Henüz doğrulanmadı:** otomatik test yok ([#137](https://github.com/yile2020/fastapi-react-admin/issues/137)), ekranların çoğu yalnızca öykünücüde çalışıyor, sürüm hattı yok

## Veritabanları

`.env` içinde `DATABASE_TYPE` ile geçiş yapın — aynı kod, aynı migration zinciri, üçü için de tohum (seed) verileri.

| | Ne için uygun | Nasıl doğrulanır |
|---|---|---|
| **PostgreSQL** (varsayılan) | yeni projeler; `docker compose up` size bir tane verir | her CI çalıştırmasında tam arka uç paketi |
| **SQL Server** | hâlihazırda Microsoft yığınında olan ekipler | her CI çalıştırmasında tam arka uç paketi + tarayıcı E2E |
| **MySQL** | hâlihazırda MySQL çalıştıran ekipler | CI'da değil; isteğe bağlı olarak yerelde tam paket çalıştırılır — son çalıştırma (2026-10-31) v0.0.1 sürümünden yükseltme dâhil tamamen geçti |

## Hızlı başlangıç

Node ≥ 22.13, Python ≥ 3.11, [uv](https://docs.astral.sh/uv/) ve Docker gerekir.

```bash
docker compose -f docker-compose.dev.yml up -d          # PostgreSQL + Redis
pnpm install:all                                        # frontend + backend dependencies
cp apps/api/backend/.env.example apps/api/backend/.env  # defaults match the containers above
pnpm db:init                                            # create tables + seed data (first run)
pnpm dev                                                # open http://127.0.0.1:8888
```

`pnpm db:init` sırasında belirlediğiniz parolayla `admin` olarak oturum açın. SQL Server / MySQL'e geçiş, S3, captcha'yı atlama ve testleri çalıştırma [CONTRIBUTING.md](./CONTRIBUTING.md#本地开发) içinde ele alınmıştır (Çince; komutlar dilden bağımsızdır).

## Kalite

1.400+ arka uç pytest testi gerçek bir veritabanına ve Redis'e karşı çalışır; 150+ Playwright testi gerçek API ve veritabanına karşı gerçek bir tarayıcıyı sürer — **mock yoktur**.
Veri izinleri 41 gerçek hesapla tek tek oturum açılarak doğrulanmıştır; temel korumalar mutasyon testinden geçirilmiştir (kodu bilerek boz, testlerin kırmızıya döndüğünü doğrula).
Her `main` çalıştırmasından gelen [E2E raporu](https://yile2020.github.io/fastapi-react-admin/e2e/), başarısızlıkların ekran görüntüleri ve videolarıyla birlikte herkese açıktır.

## Güvenlik ve performans

**Güvenlik** varsayılan olarak açıktır ve çoğu kurulum gerektirmez:

- Oturum açma: görsel captcha, hesap ve IP kilitleme, hız sınırlama, TOTP iki faktörlü doğrulama
- İzinler: izin gerektiren uç noktalar bunu ve veri kapsamını **arka uçta** kontrol eder (bir düğmeyi gizlemek yalnızca kozmetiktir); bir test ön uç, arka uç ve menü verileri arasındaki izin kodlarını çapraz kontrol eder
- Denetim: oturum açma günlüğü, işlem günlüğü (hassas alanlar depolanmadan önce gizlenir), alan düzeyinde veri değişiklik kayıtları (imzalama anahtarı ayarlandığında bir HMAC imza zinciri, böylece bir satırın değiştirilmesi, silinmesi veya eklenmesi tespit edilir), varsayılan olarak 180 gün saklanır
- Dağıtım: `ENVIRONMENT=prod` ile arka uç zayıf gizli anahtarlarda, devre dışı bırakılmış bir hız sınırlayıcıda veya bir veritabanı süper kullanıcı hesabında **başlamayı reddeder** (captcha kendi ayarını izler ve zorlanmaz)

Madde madde ayrıntılar, arkalarındaki testler ve bilinen boşluklar: [Güvenlik genel görünümü](https://yile2020.github.io/fastapi-react-admin/en/getting-started/security/).

**Performans**: her istek tam yolu izler (kimlik doğrulama · oturum · izinler · veri kapsamı · sorgu · işlem günlüğü). 12 günlük okuma uç noktasından oluşan bir karışım üzerinde sıradan bir kullanıcıyla ölçüldü:

| API worker'ları | En iyi aktarım hızı | 64 eşzamanlı |
|---|---|---|
| 1 | 113–119 istek/sn, p95 yaklaşık 95 ms | 0 başarısızlık |
| **2 (üretim imajı varsayılanı)** | **186–195 istek/sn, p95 yaklaşık 70 ms** | 0 başarısızlık, p95 yaklaşık 0,9 sn |

Referans için: aynı makinede tek bir sayfalı sorgu çalıştıran yalın FastAPI çekirdek başına yaklaşık 720–830 istek/sn yapar; buradaki tam yol yaklaşık 110 yapar.
Aradaki fark kimlik doğrulama, oturumlar, izinler, veri kapsamları ve denetimdir — yetkisiz erişim olmamasını ve sonrasında tam bir iz kalmasını satın alan güvenliğin bedeli; kapasite dâhilinde p95 100 ms'nin altında kalır.

Bir dizüstü bilgisayarda (WSL2) ölçülmüştür, bir üretim sunucusu kıyaslaması değildir. Bunun kullanıcılara nasıl karşılık geldiği, nasıl ölçekleneceği ve `pnpm loadtest` ile nasıl yeniden çalıştırılacağı:
[Performans ve kapasite](https://yile2020.github.io/fastapi-react-admin/en/getting-started/performance/).

## Belgeler

| Şunu yapmak için… | Okuyun |
|---|---|
| adım adım başlayın: hızlı başlangıç, dağıtım, ilk modülünüz, SSS, yükseltme | [belge sitesi](https://yile2020.github.io/fastapi-react-admin/en/) |
| yerelde geliştirin, testleri çalıştırın, PR açın, sürüm çıkarın | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| mühendislik kurallarını ve tuzakları öğrenin | [CLAUDE.md](./CLAUDE.md) — görev dizinli, 40+ modül notu, her iddia bir test veya ölçümle desteklenir |
| bir sunucuya dağıtın | [deploy/README.md](./deploy/README.md) |
| masaüstü uygulaması | [apps/desktop/README.md](./apps/desktop/README.md) |
| açık API ile entegre edin | [apps/api/backend/plugin/open/README.md](./apps/api/backend/plugin/open/README.md) |
| bileşen kütüphanesini yeniden kullanın | [packages/ui/PORTING.md](./packages/ui/PORTING.md) |
| güvenlik notları | [Güvenlik genel görünümü](https://yile2020.github.io/fastapi-react-admin/en/getting-started/security/) · bir güvenlik açığını [SECURITY.md](./SECURITY.md) üzerinden bildirin |
| kapasite planlaması | [Performans ve kapasite](https://yile2020.github.io/fastapi-react-admin/en/getting-started/performance/) |

## Lisans

[MIT](./LICENSE)

## Teşekkürler

Arka uç başlangıçta [fastapi-best-architecture](https://github.com/fastapi-practices/fastapi_best_architecture) (FBA) üzerine kurulmuştur — üç katmanlı yapısı, eklenti sistemi ve RBAC / veri kapsamı modeli FBA'nın tasarımından gelmektedir. Yazarına ve katkıda bulunanlarına teşekkürler 🙏 FBA da MIT lisanslıdır; orijinal telif hakkı bildirimi [`apps/api/LICENSE`](./apps/api/LICENSE) içinde korunmaktadır. Ayrıca [shadcn/ui](https://github.com/shadcn-ui/ui), [TanStack](https://github.com/TanStack), [Tiptap](https://github.com/ueberdosis/tiptap), [file-viewer](https://github.com/flyfish-dev/file-viewer) ve bunun üzerine kurulduğu diğer açık kaynaklı projelere de teşekkürler.
