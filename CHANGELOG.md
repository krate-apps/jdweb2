## 1.0.0 (2026-11-09)

### Features

* accept CCF and RSDF containers ([e8a95d4](https://github.com/krate-apps/jdweb/commit/e8a95d41ee92aa0fa09637ce240231e295c3f265))
* accept dropped DLC files anywhere in the window ([e5a9d5c](https://github.com/krate-apps/jdweb/commit/e5a9d5cf3775c58fccdf49b175386d79185d2bf9))
* add context menus on download packages and links ([3812c43](https://github.com/krate-apps/jdweb/commit/3812c438c77c7c3ef9494189f9e28db75b962823))
* add context menus on download packages and links ([4e042e0](https://github.com/krate-apps/jdweb/commit/4e042e02d7be37233554131554b8dc63875053a4))
* add context menus on link grabber rows ([6a18a31](https://github.com/krate-apps/jdweb/commit/6a18a3194a4af57b9e6fbf5db825c3be843a9384))
* add download speed limit control to the toolbar ([1ce4996](https://github.com/krate-apps/jdweb/commit/1ce4996d911725a0b70bff2f880f1560197d9284))
* add richer package context actions ([c3d5307](https://github.com/krate-apps/jdweb/commit/c3d5307c6509b930cd6478c13c0cd2bfb3e2d6b6))
* add setup flow and SQLite-backed accounts UI ([5996e47](https://github.com/krate-apps/jdweb/commit/5996e4732dce5e8fc6667f83c05fcbee31eb0301))
* add structured logging and basic metrics endpoint ([53ceb97](https://github.com/krate-apps/jdweb/commit/53ceb97955977af64494c384f8cf30e347c72086))
* bootstrap jdweb companion for JDownloader 2 ([c2ccb7e](https://github.com/krate-apps/jdweb/commit/c2ccb7e57f6205f4bd602220dd1f634045bed773))
* configure public base path via Compose or Settings ([023679e](https://github.com/krate-apps/jdweb/commit/023679ecd8ac69d1b712a466702152db10cf7fa1))
* default media paths under ~/medias/jdownloader ([4d7714b](https://github.com/krate-apps/jdweb/commit/4d7714ba9a93bfa3d071594e4e81aa75bafed469))
* edit hoster passwords from the accounts UI ([1c74ad0](https://github.com/krate-apps/jdweb/commit/1c74ad0ef29d63a8bf34fbc5f3d9223037d7dc89))
* edit JD URL paths and mover in Settings UI ([5f2f685](https://github.com/krate-apps/jdweb/commit/5f2f68524d729ad387c36c8457b43149bf4f0949))
* expose download cleanup and list filters ([4a764c8](https://github.com/krate-apps/jdweb/commit/4a764c8aae0492d57f1cbd520519378e1403b145))
* expose settings API and harden first-run security ([74baab5](https://github.com/krate-apps/jdweb/commit/74baab58a840eaa47fc4ec30f8053809dfc687f1))
* handle JD archive password dialogs in the UI ([db63587](https://github.com/krate-apps/jdweb/commit/db63587c693fbaf723c4728be80b405b51caf3b5))
* import existing JDownloader hoster accounts into SQLite ([726fc67](https://github.com/krate-apps/jdweb/commit/726fc67b862ee862faab25ca8f7bb6a6d8cfa3ea))
* let signed-in users change their password ([c40a81f](https://github.com/krate-apps/jdweb/commit/c40a81fee139c78201db327e5f3328fd08843432))
* open add-links dialog with Ctrl+L ([80de2dd](https://github.com/krate-apps/jdweb/commit/80de2dd76b0b682ec9965dc3759b4fe337e9f181))
* record library move history in SQLite ([2cf6afc](https://github.com/krate-apps/jdweb/commit/2cf6afce8241012ce29eed6ddc70ca78e0dffe4e))
* retry failed archive extraction with a password ([ef2cad0](https://github.com/krate-apps/jdweb/commit/ef2cad0c992e4ce07f70ff3b5e87a219d4c1c389))
* send HTTP webhooks when packages finish or move ([0207cbe](https://github.com/krate-apps/jdweb/commit/0207cbea4b577c8d69d6e4f57810e8b24fbea304))
* show link-crawler progress after adding links ([bea8540](https://github.com/krate-apps/jdweb/commit/bea8540ba05e8e51be7278dd55158e20d36c8657))
* show toast notifications when downloads finish ([f8ae739](https://github.com/krate-apps/jdweb/commit/f8ae7393ee5705a666b70dae6e81358aac378c26))
* store app settings in SQLite ([d41b56e](https://github.com/krate-apps/jdweb/commit/d41b56e42fd4242f13f18226bd8764f66707f53e))
* store sessions server-side so they can be revoked ([fe59658](https://github.com/krate-apps/jdweb/commit/fe5965875982ac519f654a4ce3e1be754df3506d))
* store users and hosters in SQLite with argon2id and AES-GCM ([c08cdc7](https://github.com/krate-apps/jdweb/commit/c08cdc768326b4c500f715fdedb8cb0c623eb4a7))
* suggest existing library folders for destinations ([f25ced7](https://github.com/krate-apps/jdweb/commit/f25ced7a6892c4acd5021bf669ed1cd5ce1fb7f6))
* suggest other-library folders in destinations ([c102e93](https://github.com/krate-apps/jdweb/commit/c102e938e40fb125ca552697621ece5fe23f7e55))
* support DLC containers when adding links ([0d20a16](https://github.com/krate-apps/jdweb/commit/0d20a16b1358290ff2ef983e6a8506fb9ea15151))
* support JDWEB_DATA_KEY rotation with re-encryption ([003a1c0](https://github.com/krate-apps/jdweb/commit/003a1c01d5db46f23e4fc8880778976b7238b98c))
* trigger library move manually from the UI ([c8277ec](https://github.com/krate-apps/jdweb/commit/c8277ec8ef909776618eb4d60e2628bb92c5c2f7))

### Bug Fixes

* allow Google Fonts in Content-Security-Policy ([7fea352](https://github.com/krate-apps/jdweb/commit/7fea3520d4a91deb161c1da559c27f7cf81de4e7))
* serve SPA assets from absolute web/dist under base path ([f38835c](https://github.com/krate-apps/jdweb/commit/f38835c864299dc9d09bb3da55a69c0715f7ab8e))

### User Experience

* add About modal opened from the brand mark ([3f04f88](https://github.com/krate-apps/jdweb/commit/3f04f88fe273e55d6d577b68011e78dd46454a69))
* add project favicon and refresh the README ([8cb4574](https://github.com/krate-apps/jdweb/commit/8cb4574b20767b4bd16c282d1256d356e5c0953b))
* align Accounts, Grabber, and About with new UI ([40ae4cc](https://github.com/krate-apps/jdweb/commit/40ae4cce4b4c9c0b00ee8e8a34a8f1c614400919))
* keep Downloads filter and sort on one row ([4ca7ada](https://github.com/krate-apps/jdweb/commit/4ca7adaa8522869aa125279e42adf223670d3180))
* polish Downloads table and selection bar ([a12860d](https://github.com/krate-apps/jdweb/commit/a12860d8f94494cf697ea52520827e66e1d95c89))
* redesign Settings with section navigation ([af3e1ce](https://github.com/krate-apps/jdweb/commit/af3e1ce1dd97d0e482d7e0705de4feeb73cbb9a8))
* refine AppShell chrome and Settings panels ([0e443ce](https://github.com/krate-apps/jdweb/commit/0e443ced0ad94684f997851e993cf2589cc314dd))
* refresh design tokens typography and atmosphere ([5bf015b](https://github.com/krate-apps/jdweb/commit/5bf015b4b3f09907c28ffae2250fab2ec3b5e0d2))
* refresh Login and Setup screens ([337598b](https://github.com/krate-apps/jdweb/commit/337598bcf426fbd6953ac0f8c468c447861e6c51))
* restore home logo and add Lucide icons to chrome ([b3e2f86](https://github.com/krate-apps/jdweb/commit/b3e2f86d1dc383bfb4d4c64132cb21cdab46ac4b))
* show brand logo in the navbar ([fa17031](https://github.com/krate-apps/jdweb/commit/fa170310fcb812ffd566076732bfafd2245a1cbb))
* stop duplicating jdweb in the About header ([63e70bd](https://github.com/krate-apps/jdweb/commit/63e70bd180bf3c67f3853d366d4beda0c8985b74))

### Internationalization

* rewrite copy to be user-facing, not architecture notes ([3d4a078](https://github.com/krate-apps/jdweb/commit/3d4a07854e7878e006dd10dfe3b6e421b89672ec))
