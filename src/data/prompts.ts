export interface GuidingPrompt {
  id: string;
  question: string;
  placeholder: string;
}

export const GUIDING_PROMPTS: GuidingPrompt[] = [
  {
    id: 'rok',
    question:
      'Hvaða rök (staðreyndir) styðja þessa hugsun og hvaða rök mæla á móti henni?',
    placeholder: 'Staðreyndir með og á móti...',
  },
  {
    id: 'efa',
    question:
      'Er hægt að draga þessa hugsun í efa eða horfa á aðstæðurnar frá öðru sjónarhorni?',
    placeholder: 'Önnur skýring eða sjónarhorn...',
  },
  {
    id: 'vinur',
    question:
      'Hvað myndi ég segja við góðan vin ef hann hefði þessa sömu hugsun?',
    placeholder: 'Mildari og raunsærri orð við vin...',
  },
  {
    id: 'utkoma',
    question:
      'Hvað er það versta sem gæti gerst, það besta, og hvað er líklegast?',
    placeholder: 'Líklegasta útkoman í raun...',
  },
  {
    id: 'timi',
    question:
      'Hversu miklu máli mun þetta skipta eftir viku, mánuð eða ár?',
    placeholder: 'Stóra samhengið yfir tíma...',
  },
];
