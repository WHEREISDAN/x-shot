import {
  addressRegex,
  emailRegex,
  ipv4Regex,
  phoneRegex,
} from '../renderer/hooks/pii/regex';

function firstMatch(regex: RegExp, text: string): string | null {
  return text.match(new RegExp(regex.source, regex.flags))?.[0] ?? null;
}

describe('phoneRegex', () => {
  it.each([
    ['(555) 123-4567', '(555) 123-4567'],
    ['(555)123-4567', '(555)123-4567'],
    ['555-123-4567', '555-123-4567'],
    ['555.123.4567', '555.123.4567'],
    ['+1 555 123 4567', '+1 555 123 4567'],
    ['+1 (555) 123-4567', '+1 (555) 123-4567'],
    ['+44 20 7946 0958', '+44 20 7946 0958'],
    ['+15551234567', '+15551234567'],
    ['555-1234', '555-1234'],
    ['555-123-4567 ext. 89', '555-123-4567 ext. 89'],
    ['Phone: (555) 123-4567', '(555) 123-4567'],
    ['Mobile: 555-987-6543', '555-987-6543'],
  ])('matches %j', (text, expected) => {
    expect(firstMatch(phoneRegex, text)).toBe(expected);
  });

  it.each([
    ['an IPv4 address', '192.168.100.200'],
    ['a short IPv4 address', '10.0.0.1'],
    ['an IP in a sentence', 'Server at 192.168.10.24 is online'],
    ['an epoch timestamp', '1696262400'],
    ['an order number', '12345678'],
    ['an SSN', '123-45-6789'],
    ['an ISO date', '2024-10-02'],
    ['a ZIP+4 code', '12345-6789'],
    ['a card number', '4111 1111 1111 1111'],
  ])('does not match %s', (_label, text) => {
    expect(firstMatch(phoneRegex, text)).toBeNull();
  });
});

describe('addressRegex', () => {
  it.each([
    ['123 Main Street', '123 Main Street'],
    ['123 Main St.', '123 Main St.'],
    ['1234 OAK STREET', '1234 OAK STREET'],
    ['742 Evergreen Terrace', '742 Evergreen Terrace'],
    ['221B Baker Street', '221B Baker Street'],
    ['4567 N Elm Ave', '4567 N Elm Ave'],
    ['89 West 42nd Street', '89 West 42nd Street'],
    ['1600 Pennsylvania Avenue NW', '1600 Pennsylvania Avenue NW'],
    ['12 Martin Luther King Jr Blvd', '12 Martin Luther King Jr Blvd'],
    ['10 Downing St, Apt 4B', '10 Downing St, Apt 4B'],
    ['350 Fifth Avenue, Suite 3300', '350 Fifth Avenue, Suite 3300'],
    ['55 Oak Ln #12', '55 Oak Ln #12'],
    ['Ship to 77 Sunset Blvd. Apt. 9 today', '77 Sunset Blvd. Apt. 9'],
    ['P.O. Box 123', 'P.O. Box 123'],
    ['PO Box 4567', 'PO Box 4567'],
    ['Post Office Box 89', 'Post Office Box 89'],
  ])('matches %j', (text, expected) => {
    expect(firstMatch(addressRegex, text)).toBe(expected);
  });

  it.each([
    '3 issues in Google Drive',
    '5 miles down the road',
    '2 is the way',
    'Call me in 10 minutes on the Main Street',
    'I bought 4 tickets for Broadway',
    'Mainstreet 5',
  ])('does not match %j', (text) => {
    expect(firstMatch(addressRegex, text)).toBeNull();
  });
});

describe('emailRegex and ipv4Regex', () => {
  it('match the common forms', () => {
    expect(firstMatch(emailRegex, 'Contact: jane.doe@example.com')).toBe(
      'jane.doe@example.com',
    );
    expect(firstMatch(ipv4Regex, 'Server at 192.168.10.24 is online')).toBe(
      '192.168.10.24',
    );
  });
});
