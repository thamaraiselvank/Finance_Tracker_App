const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const underThousand = (value) => {
  if (value < 20) return ones[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`;
  return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${underThousand(value % 100)}` : ''}`;
};

export function inrInWords(value, currency = 'INR') {
  const amount = Math.round(Number(value) || 0);
  const currencyNames = {
    INR: 'rupees',
    USD: 'dollars',
    EUR: 'euros',
    GBP: 'pounds',
  };
  const currencyName = currencyNames[currency] || currencyNames.INR;
  if (amount === 0) return `zero ${currencyName}`;

  if (currency !== 'INR') {
    const parts = [];
    const billion = Math.floor(amount / 1000000000);
    const million = Math.floor((amount % 1000000000) / 1000000);
    const thousand = Math.floor((amount % 1000000) / 1000);
    const remainder = amount % 1000;

    if (billion) parts.push(`${underThousand(billion)} billion`);
    if (million) parts.push(`${underThousand(million)} million`);
    if (thousand) parts.push(`${underThousand(thousand)} thousand`);
    if (remainder) parts.push(underThousand(remainder));

    return `${parts.join(' ')} ${currencyName}`;
  }

  const parts = [];
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const remainder = amount % 1000;

  if (crore) parts.push(`${underThousand(crore)} crore`);
  if (lakh) parts.push(`${underThousand(lakh)} lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} thousand`);
  if (remainder) parts.push(underThousand(remainder));

  return `${parts.join(' ')} rupees`;
}
