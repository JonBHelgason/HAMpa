# HAMpa

Íslenskt mobile-first vefforrit (PWA) fyrir hugræna atferlismeðferð (HAM):

- **4 dálka hugsanaskráning** (Aðstæður, Tilfinning, Hugsun og Endurmat með hugsanavillum, leiðandi spurningum og samanburði fyrir/eftir).
- **3ja laga tilfinningahjól** á íslensku með styrkmælingu (0–100%) og leit í öllum orðum.
- **Skrá líðan** fyrir fljótlegar skráningar yfir daginn.
- **Dagbók** (morgunn og kvöld með sérsníðanlegum venjulista).
- **Dagatal** með lituðum hlutfallshringjum hvers dags og samanburði á svefni og líðan.
- **Mynstur** yfir merki, hugsanavillur og árangur endurmats.
- **100% staðbundin geymsla** í vafra (**IndexedDB**) með JSON-afritun og endurheimt — engin innskráning og engin persónuleg gögn send á netþjón.

## Keyra staðbundið

```bash
npm install
npm run dev
```

Prófanir og PWA-bygging:

```bash
npm test
npm run build
```

## Birta á GitHub Pages

1. Farðu í **Settings → Pages** í GitHub-hirslunni.
2. Undir **Build and deployment → Source** skaltu velja **GitHub Actions**.
3. Þegar verkflæðið `.github/workflows/deploy.yml` hefur keyrt birtist HAMpa sjálfkrafa og hægt er að bæta því á heimaskjá í síma („Add to Home Screen“).
