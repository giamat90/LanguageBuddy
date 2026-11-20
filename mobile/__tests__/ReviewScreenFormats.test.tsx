import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ReviewScreen from '../src/screens/ReviewScreen';
import { fetchDueReviews, gradeReview, type ReviewCard } from '../src/services/reviewService';

jest.mock('../src/services/reviewService', () => ({
  fetchDueReviews: jest.fn(),
  gradeReview: jest.fn().mockResolvedValue(undefined),
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

function setup(cards: ReviewCard[]) {
  (fetchDueReviews as jest.Mock).mockResolvedValue(cards);
  return render(<ReviewScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  (gradeReview as jest.Mock).mockResolvedValue(undefined);
});

function bank(id: string, word: string, it: string, en: string, over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id,
    word,
    article: 'das',
    translationIt: it,
    translationEn: en,
    exampleDe: null,
    exampleIt: null,
    exampleEn: null,
    partOfSpeech: 'noun',
    cefrBand: 'A1',
    topicDomain: 'food',
    timesSeen: 1,
    retentionScore: 0.5,
    ...over,
  };
}

const brotNew = bank('c1', 'Brot', 'pane', 'bread');
const brotLearning = bank('c1', 'Brot', 'pane', 'bread', {
  exampleDe: 'Ich kaufe das Brot beim Bäcker.',
  exampleIt: 'Compro il pane dal panettiere.',
  exampleEn: 'I buy the bread at the baker.',
  article: null, // no article: "find the mistake" needs one, so reorder stays the only second candidate
  timesSeen: 2,
  retentionScore: 0.7,
});
const four = [
  bank('c1', 'Brot', 'pane', 'bread'),
  bank('c2', 'Wasser', 'acqua', 'water'),
  bank('c3', 'Haus', 'casa', 'house'),
  bank('c4', 'Buch', 'libro', 'book'),
];

describe('ReviewScreen — multiple choice', () => {
  it('a new word shows four options; the right one grades 0.8', async () => {
    const ui = setup([brotNew]);
    expect(await ui.findAllByTestId(/^mc-option-/)).toHaveLength(4);
    expect(ui.getByText('Cosa significa?')).toBeTruthy();

    fireEvent.press(ui.getByText('pane'));
    expect(ui.getByText('Corretto!')).toBeTruthy();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.8));
  });

  it('a wrong option grades 0 once, the card returns as a retry, and the retry is not graded', async () => {
    const ui = setup([brotNew]);
    const options = await ui.findAllByTestId(/^mc-option-/);
    fireEvent.press(options.find((o) => o.props.accessibilityLabel !== 'pane')!);
    expect(ui.getByText('Risposta: pane')).toBeTruthy();

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0));
    expect(await ui.findByText('Riprova')).toBeTruthy();

    fireEvent.press(await ui.findByText('pane'));
    fireEvent.press(ui.getByText('Continua'));
    expect(await ui.findByText('0 su 1 al primo colpo')).toBeTruthy();
    expect(gradeReview).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewScreen — matching pairs', () => {
  const pair = async (ui: ReturnType<typeof render>, left: string, right: string) => {
    fireEvent.press(await ui.findByTestId(`match-left-${left}`));
    fireEvent.press(ui.getByTestId(`match-right-${right}`));
  };

  it('four new words form one round; a clean round grades each card 0.7', async () => {
    const ui = setup(four);
    expect(await ui.findByText('Abbina ogni parola al suo significato')).toBeTruthy();
    for (const id of ['c1', 'c2', 'c3', 'c4']) await pair(ui, id, id);

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledTimes(4));
    for (const id of ['c1', 'c2', 'c3', 'c4']) expect(gradeReview).toHaveBeenCalledWith(id, 0.7);
    expect(await ui.findByText('4 su 4 al primo colpo')).toBeTruthy();
  });

  it('a wrong pairing costs both cards, which come back as retries', async () => {
    const ui = setup(four);
    await pair(ui, 'c1', 'c2'); // wrong: Brot with "acqua"
    for (const id of ['c1', 'c2', 'c3', 'c4']) await pair(ui, id, id);

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledTimes(4));
    expect(gradeReview).toHaveBeenCalledWith('c1', 0.4);
    expect(gradeReview).toHaveBeenCalledWith('c2', 0.4);
    expect(gradeReview).toHaveBeenCalledWith('c3', 0.7);
    expect(gradeReview).toHaveBeenCalledWith('c4', 0.7);
    expect(await ui.findByText('Riprova')).toBeTruthy();
  });

  it('a double-tapped Continue grades each card once', async () => {
    const ui = setup(four);
    for (const id of ['c1', 'c2', 'c3', 'c4']) await pair(ui, id, id);
    const btn = ui.getByText('Continua');
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => expect(gradeReview).toHaveBeenCalledTimes(4));
    expect(gradeReview).toHaveBeenCalledTimes(4);
  });
});

describe('ReviewScreen — sentence reorder', () => {
  let random: jest.SpyInstance;
  beforeEach(() => {
    // 0.99 picks reorder (weights 2:1) and leaves the shuffle unchanged, which rotates the tokens left by one.
    random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => random.mockRestore());

  const solution = ['Ich', 'kaufe', 'das', 'Brot', 'beim', 'Bäcker.'];
  const shown = ['kaufe', 'das', 'Brot', 'beim', 'Bäcker.', 'Ich'];
  const place = (ui: ReturnType<typeof render>, tokens: string[]) =>
    tokens.forEach((t) => fireEvent.press(ui.getByText(t)));

  it('the right order grades 0.9', async () => {
    const ui = setup([brotLearning]);
    expect(await ui.findByText("Metti le parole nell'ordine giusto")).toBeTruthy();
    place(ui, solution);
    fireEvent.press(ui.getByText('Controlla'));
    expect(ui.getByText('Corretto!')).toBeTruthy();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.9));
  });

  it('a wrong order shows the sentence; "my sentence is correct" grades 0.5', async () => {
    const ui = setup([brotLearning]);
    await ui.findByText('Controlla');
    place(ui, shown);
    fireEvent.press(ui.getByText('Controlla'));
    expect(ui.getByText('Frase corretta: Ich kaufe das Brot beim Bäcker.')).toBeTruthy();

    fireEvent.press(ui.getByText('La mia frase è corretta'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.5));
  });

  it('a wrong order followed by Continue grades 0', async () => {
    const ui = setup([brotLearning]);
    await ui.findByText('Controlla');
    place(ui, shown);
    fireEvent.press(ui.getByText('Controlla'));
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0));
  });

  it('"Non ricordo" reveals the sentence without the override', async () => {
    const ui = setup([brotLearning]);
    fireEvent.press(await ui.findByText('Non ricordo'));
    expect(ui.getByText('Frase corretta: Ich kaufe das Brot beim Bäcker.')).toBeTruthy();
    expect(ui.queryByText('La mia frase è corretta')).toBeNull();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0));
  });

  it('tiles can be taken back and the answer restarted', async () => {
    const ui = setup([brotLearning]);
    await ui.findByText('Controlla');
    fireEvent.press(ui.getByText('Ich'));
    expect(ui.queryByTestId('reorder-pool-5')).toBeNull(); // "Ich" left the pool
    fireEvent.press(ui.getByText('Ricomincia'));
    expect(ui.queryByText('Ricomincia')).toBeNull();
    expect(ui.getByTestId('reorder-pool-5')).toBeTruthy(); // back at its slot
  });
});

describe('ReviewScreen — find the mistake', () => {
  let random: jest.SpyInstance;
  beforeEach(() => {
    // 0.99 picks the last candidate (find the mistake, weights 2:1:1) and leaves every shuffle unchanged:
    // "Das Haus ist sehr groß." becomes "Den Haus ist sehr groß." with options Der / Die / Das.
    random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => random.mockRestore());

  const haus = bank('c1', 'Haus', 'casa', 'house', {
    exampleDe: 'Das Haus ist sehr groß.',
    exampleIt: 'La casa è molto grande.',
    exampleEn: 'The house is very big.',
    timesSeen: 2,
    retentionScore: 0.7,
  });
  const lehrer = bank('c2', 'sprechen', 'parlare', 'to speak', {
    article: null,
    partOfSpeech: 'verb',
    exampleDe: 'Ich spreche mit dem Lehrer.',
    exampleIt: 'Parlo con il maestro.',
    exampleEn: 'I speak with the teacher.',
    timesSeen: 2,
    retentionScore: 0.7,
  });

  it('the right word and the right form grade 0.9, with the grammar explanation', async () => {
    const ui = setup([haus]);
    expect(await ui.findByText('Nella frase c\'è un errore. Toccalo.')).toBeTruthy();
    fireEvent.press(ui.getByTestId('mistake-token-0')); // "Den"
    expect(ui.getByText('Qual è la forma giusta?')).toBeTruthy();
    fireEvent.press(ui.getByText('Das'));
    expect(ui.getByText('Corretto!')).toBeTruthy();
    expect(ui.getByText(/Il genere va imparato/)).toBeTruthy();

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.9));
  });

  it('the right word but the wrong form is a miss (0.4) and the card returns', async () => {
    const ui = setup([haus]);
    fireEvent.press(await ui.findByTestId('mistake-token-0'));
    fireEvent.press(ui.getByText('Der'));
    expect(ui.getByText('Forma corretta: Das')).toBeTruthy();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.4));
    expect(await ui.findByText('Riprova')).toBeTruthy();
  });

  it('tapping the wrong word reveals the real mistake and grades 0, with no fix step', async () => {
    const ui = setup([haus]);
    fireEvent.press(await ui.findByTestId('mistake-token-1')); // "Haus"
    expect(ui.getByText('L\'errore era «Den»: va scritto «Das».')).toBeTruthy();
    expect(ui.queryByTestId('mistake-option-0')).toBeNull();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0));
  });

  it('the words stop responding once the exercise has ended', async () => {
    const ui = setup([haus]);
    fireEvent.press(await ui.findByTestId('mistake-token-0'));
    fireEvent.press(ui.getByText('Das'));
    expect(ui.getByTestId('mistake-token-1').props.accessibilityState?.disabled).toBe(true);
  });

  it('a double-tapped Continue grades once', async () => {
    const ui = setup([haus]);
    fireEvent.press(await ui.findByTestId('mistake-token-0'));
    fireEvent.press(ui.getByText('Das'));
    const btn = ui.getByText('Continua');
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    await waitFor(() => expect(gradeReview).toHaveBeenCalledTimes(1));
  });

  it('a case mistake shows the matching rule', async () => {
    const ui = setup([lehrer]);
    fireEvent.press(await ui.findByTestId('mistake-token-3')); // "des" instead of "dem"
    fireEvent.press(ui.getByText('dem'));
    expect(ui.getByText('Corretto!')).toBeTruthy();
    expect(ui.getByText(/Dopo aus, bei, mit/)).toBeTruthy();
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c2', 0.9));
  });
});
