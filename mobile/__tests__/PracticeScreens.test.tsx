import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PracticeMenuScreen from '../src/screens/PracticeMenuScreen';
import PracticeSessionScreen from '../src/screens/PracticeSessionScreen';
import { fetchVaultCards, gradePractice, type ReviewCard } from '../src/services/reviewService';

jest.mock('../src/services/reviewService', () => ({
  fetchVaultCards: jest.fn(),
  gradePractice: jest.fn().mockResolvedValue(undefined),
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, unknown> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

function word(id: string, w: string, it: string, en: string, sentence: string | null): ReviewCard {
  return {
    id,
    word: w,
    article: 'das',
    translationIt: it,
    translationEn: en,
    exampleDe: sentence,
    exampleIt: sentence ? 'x' : null,
    exampleEn: sentence ? 'x' : null,
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'food',
    timesSeen: 6, // strong: the review ladder would never offer these easy formats
    retentionScore: 0.95,
  };
}

const brot = word('c1', 'Brot', 'pane', 'bread', 'Ich kaufe das Brot beim Bäcker.');
const five = [
  brot,
  word('c2', 'Wasser', 'acqua', 'water', 'Ich trinke ein Glas Wasser.'),
  word('c3', 'Haus', 'casa', 'house', 'Das Haus ist sehr groß.'),
  word('c4', 'Buch', 'libro', 'book', 'Ich lese ein Buch.'),
  word('c5', 'Tisch', 'tavolo', 'table', 'Der Tisch ist sehr alt.'),
];

function vault(cards: ReviewCard[]) {
  (fetchVaultCards as jest.Mock).mockResolvedValue(cards);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (gradePractice as jest.Mock).mockResolvedValue(undefined);
});

describe('PracticeMenuScreen', () => {
  const fmt = (ui: ReturnType<typeof render>, f: string) => ui.getByTestId(`practice-format-${f}`);
  const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) =>
    el.props.accessibilityState?.disabled === true;

  it('lists the five formats and the schedule note', async () => {
    vault(five);
    const ui = render(<PracticeMenuScreen />);
    for (const label of ['Misto', 'Abbina', 'Scelta multipla', 'Riordina la frase', "Trova l'errore", 'Scrivi la parola']) {
      expect(await ui.findByText(label)).toBeTruthy();
    }
    expect(ui.getByText(/Allenati quando vuoi/)).toBeTruthy();
  });

  it('enables every format when the vault supports it, and starts the chosen one', async () => {
    vault(five);
    const ui = render(<PracticeMenuScreen />);
    await ui.findByText('Misto');
    await waitFor(() => expect(disabled(fmt(ui, 'matching'))).toBe(false));

    fireEvent.press(fmt(ui, 'multiple_choice'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(app)/practice-session',
      params: { format: 'multiple_choice' },
    });
  });

  it('disables matching with fewer than four words, says why, and does not navigate', async () => {
    vault([five[0], five[1]]);
    const ui = render(<PracticeMenuScreen />);
    expect(await ui.findByText('Servono almeno 4 parole salvate.')).toBeTruthy();
    expect(disabled(fmt(ui, 'matching'))).toBe(true);
    expect(disabled(fmt(ui, 'mixed'))).toBe(false);

    fireEvent.press(fmt(ui, 'matching'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('an empty vault disables everything and asks for words', async () => {
    vault([]);
    const ui = render(<PracticeMenuScreen />);
    expect(await ui.findByText('Salva qualche parola per iniziare a praticare.')).toBeTruthy();
    for (const f of ['mixed', 'matching', 'multiple_choice', 'sentence_reorder', 'find_mistake', 'typed_cloze']) {
      expect(disabled(fmt(ui, f))).toBe(true);
    }
  });

  it('a load failure is logged and treated as an empty vault', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (fetchVaultCards as jest.Mock).mockRejectedValue(new Error('boom: database exploded'));
    const ui = render(<PracticeMenuScreen />);
    expect(await ui.findByText('Salva qualche parola per iniziare a praticare.')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    expect(ui.queryByText(/boom|exploded/)).toBeNull();
    spy.mockRestore();
  });
});

describe('PracticeSessionScreen', () => {
  let random: jest.SpyInstance;
  beforeEach(() => {
    // 0.1 keeps multiple choice in the to_native direction and mixed on typed cloze.
    random = jest.spyOn(Math, 'random').mockReturnValue(0.1);
  });
  afterEach(() => random.mockRestore());

  it('multiple choice ignores the review ladder, grades through gradePractice and offers another round', async () => {
    mockParams = { format: 'multiple_choice' };
    vault([brot]);
    const ui = render(<PracticeSessionScreen />);

    expect(await ui.findAllByTestId(/^mc-option-/)).toHaveLength(4);
    expect(ui.getByText('Pratica')).toBeTruthy(); // badge: this is not a scheduled review

    fireEvent.press(ui.getByText('pane'));
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradePractice).toHaveBeenCalledWith('c1', 0.8));

    expect(await ui.findByText('Pratica completata! 💪')).toBeTruthy();
    expect(ui.getByText('1 su 1 al primo colpo')).toBeTruthy();
    expect(ui.getByText(/Il calendario dei ripassi cambia solo/)).toBeTruthy();

    fireEvent.press(ui.getByText('Ancora'));
    expect(await ui.findAllByTestId(/^mc-option-/)).toHaveLength(4);
    expect(fetchVaultCards).toHaveBeenCalledTimes(2);
  });

  it('a wrong answer is graded once and the word returns as a retry', async () => {
    mockParams = { format: 'multiple_choice' };
    vault([brot]);
    const ui = render(<PracticeSessionScreen />);
    const options = await ui.findAllByTestId(/^mc-option-/);
    fireEvent.press(options.find((o) => o.props.accessibilityLabel !== 'pane')!);
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradePractice).toHaveBeenCalledWith('c1', 0));

    expect(await ui.findByText('Riprova')).toBeTruthy();
    fireEvent.press(await ui.findByText('pane'));
    fireEvent.press(ui.getByText('Continua'));
    expect(await ui.findByText('0 su 1 al primo colpo')).toBeTruthy();
    expect(gradePractice).toHaveBeenCalledTimes(1);
  });

  it('typed cloze is offered even for a strong word', async () => {
    mockParams = { format: 'typed_cloze' };
    vault([brot]);
    const ui = render(<PracticeSessionScreen />);
    fireEvent.changeText(await ui.findByPlaceholderText('Scrivi la parola mancante'), 'Brot');
    fireEvent.press(ui.getByText('Controlla'));
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradePractice).toHaveBeenCalledWith('c1', 1));
  });

  it.each([[undefined], ['bogus']])('format %p behaves as Mixed', async (format) => {
    mockParams = format === undefined ? {} : { format };
    vault([brot]);
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByPlaceholderText('Scrivi la parola mancante')).toBeTruthy(); // mixed + rng 0.1 → typed cloze
  });

  it('a matching round over five words grades each through gradePractice', async () => {
    mockParams = { format: 'matching' };
    vault(five);
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByText('Abbina ogni parola al suo significato')).toBeTruthy();
    for (const c of five) {
      fireEvent.press(ui.getByTestId(`match-left-${c.id}`));
      fireEvent.press(ui.getByTestId(`match-right-${c.id}`));
    }
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradePractice).toHaveBeenCalledTimes(5));
    for (const c of five) expect(gradePractice).toHaveBeenCalledWith(c.id, 0.7);
    expect(await ui.findByText('5 su 5 al primo colpo')).toBeTruthy();
  });

  it('matching shows only matching rounds: words left over after the round are not turned into flip-cards', async () => {
    mockParams = { format: 'matching' };
    const seven = [
      ...five,
      word('c6', 'Stuhl', 'sedia', 'chair', 'Der Stuhl ist sehr alt.'),
      word('c7', 'Bett', 'letto', 'bed', 'Das Bett ist sehr groß.'),
    ];
    vault(seven);
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByText('Abbina ogni parola al suo significato')).toBeTruthy();
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].filter((id) => ui.queryByTestId(`match-left-${id}`));
    expect(ids).toHaveLength(5);
    for (const id of ids) {
      fireEvent.press(ui.getByTestId(`match-left-${id}`));
      fireEvent.press(ui.getByTestId(`match-right-${id}`));
    }
    fireEvent.press(ui.getByText('Continua'));
    expect(await ui.findByText('5 su 5 al primo colpo')).toBeTruthy();
    expect(ui.queryByText('Mostra significato')).toBeNull();
    expect(gradePractice).toHaveBeenCalledTimes(5);
  });

  it('find the mistake runs a session on qualifying words and grades through gradePractice', async () => {
    mockParams = { format: 'find_mistake' };
    vault([five[2]]); // Haus: "Das Haus ist sehr groß."
    const ui = render(<PracticeSessionScreen />);
    fireEvent.press(await ui.findByTestId('mistake-token-0'));
    fireEvent.press(ui.getByText('Das'));
    expect(ui.getByText('Corretto!')).toBeTruthy();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradePractice).toHaveBeenCalledWith('c3', 0.9));
    expect(await ui.findByText('1 su 1 al primo colpo')).toBeTruthy();
  });

  it('find the mistake with no qualifying sentence says nothing fits', async () => {
    mockParams = { format: 'find_mistake' };
    vault([word('c9', 'Stuhl', 'sedia', 'chair', null)]);
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByText('Nessuna parola adatta a questo esercizio.')).toBeTruthy();
  });

  it('says so when no saved word fits the format, with no second round on offer', async () => {
    mockParams = { format: 'sentence_reorder' };
    vault([word('c9', 'Stuhl', 'sedia', 'chair', null)]);
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByText('Nessuna parola adatta a questo esercizio.')).toBeTruthy();
    expect(ui.queryByText('Ancora')).toBeNull();
    expect(ui.queryByText(/al primo colpo/)).toBeNull();
  });

  it('a load failure is logged and shown without raw error text', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockParams = { format: 'mixed' };
    (fetchVaultCards as jest.Mock).mockRejectedValue(new Error('boom: database exploded'));
    const ui = render(<PracticeSessionScreen />);
    expect(await ui.findByText('Nessuna parola adatta a questo esercizio.')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    expect(ui.queryByText(/boom|exploded/)).toBeNull();
    spy.mockRestore();
  });
});
