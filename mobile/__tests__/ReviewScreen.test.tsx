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

const wasser: ReviewCard = {
  id: 'c1',
  word: 'Wasser',
  article: 'das',
  translationIt: 'acqua',
  translationEn: 'water',
  exampleDe: 'Ich trinke Wasser.',
  exampleIt: 'Bevo acqua.',
  exampleEn: 'I drink water.',
  timesSeen: 2,
  retentionScore: 0.7,
};
const flashOnly: ReviewCard = { ...wasser, id: 'c2', word: 'Haus', exampleDe: null };

const PLACEHOLDER = 'Scrivi la parola mancante';

function setup(cards: ReviewCard[]) {
  (fetchDueReviews as jest.Mock).mockResolvedValue(cards);
  return render(<ReviewScreen />);
}

async function typeAndCheck(utils: ReturnType<typeof render>, text: string) {
  fireEvent.changeText(await utils.findByPlaceholderText(PLACEHOLDER), text);
  fireEvent.press(utils.getByText('Controlla'));
}

beforeEach(() => {
  jest.clearAllMocks();
  (gradeReview as jest.Mock).mockResolvedValue(undefined);
});

describe('ReviewScreen (exercise engine)', () => {
  it('typed cloze: an exact answer grades 1 and the summary shows first-try accuracy', async () => {
    const ui = setup([wasser]);
    await typeAndCheck(ui, 'wasser');
    expect(ui.getByText('Corretto!')).toBeTruthy();

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 1));
    expect(await ui.findByText('1 su 1 al primo colpo')).toBeTruthy();
  });

  it('typed cloze: a typo shows "Quasi!" with the spelling and grades 0.7', async () => {
    const ui = setup([wasser]);
    await typeAndCheck(ui, 'Wassr');
    expect(ui.getByText('Quasi! Si scrive: Wasser')).toBeTruthy();

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.7));
  });

  it('hint: shows first letter and length, then caps a correct answer at 0.6', async () => {
    const ui = setup([wasser]);
    fireEvent.press(await ui.findByText('Suggerimento'));
    expect(ui.getByText('Inizia con "W" · 6 lettere')).toBeTruthy();

    await typeAndCheck(ui, 'Wasser');
    expect(ui.queryByText('Suggerimento')).toBeNull(); // hidden once checked
    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0.6));
  });

  it('a wrong answer is graded once, the card returns tagged "Riprova", and the retry is not graded', async () => {
    const ui = setup([wasser]);
    fireEvent.press(await ui.findByText('Non ricordo'));
    expect(ui.getByText('Risposta: Wasser')).toBeTruthy();
    expect(ui.queryByText('Riprova')).toBeNull();

    fireEvent.press(ui.getByText('Continua'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c1', 0));

    expect(await ui.findByText('Riprova')).toBeTruthy();
    await typeAndCheck(ui, 'Wasser');
    fireEvent.press(ui.getByText('Continua'));

    expect(await ui.findByText('0 su 1 al primo colpo')).toBeTruthy();
    expect(gradeReview).toHaveBeenCalledTimes(1);
  });

  it('a double-tapped Continue grades the card once and does not touch the next card', async () => {
    const ui = setup([wasser, flashOnly]);
    await typeAndCheck(ui, 'Wasser');
    const continueBtn = ui.getByText('Continua');

    // Both taps land on the same render's handler (no re-render in between).
    await act(async () => {
      fireEvent.press(continueBtn);
      fireEvent.press(continueBtn);
    });

    await waitFor(() => expect(gradeReview).toHaveBeenCalledTimes(1));
    expect(gradeReview).toHaveBeenCalledWith('c1', 1);
    expect(await ui.findByText('Mostra significato')).toBeTruthy(); // now on the flashcard, ungraded
  });

  it('a card without an example is a flashcard graded 1 / 0 as before', async () => {
    const ui = setup([flashOnly]);
    fireEvent.press(await ui.findByText('Mostra significato'));
    fireEvent.press(ui.getByText('Lo sapevo'));
    await waitFor(() => expect(gradeReview).toHaveBeenCalledWith('c2', 1));
  });

  it('progress counts first attempts, not retries', async () => {
    const ui = setup([wasser, flashOnly]);
    expect(await ui.findByText('1 di 2')).toBeTruthy();
    fireEvent.press(ui.getByText('Non ricordo'));
    fireEvent.press(ui.getByText('Continua'));
    expect(await ui.findByText('2 di 2')).toBeTruthy();
  });

  it('a load failure is logged and shown as "nothing due" without raw error text', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (fetchDueReviews as jest.Mock).mockRejectedValue(new Error('boom: database exploded'));
    const ui = render(<ReviewScreen />);

    expect(await ui.findByText('Niente da ripassare oggi.')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    expect(ui.queryByText(/boom|exploded/)).toBeNull();
    spy.mockRestore();
  });

  it('nothing due: no summary line', async () => {
    const ui = setup([]);
    expect(await ui.findByText('Niente da ripassare oggi.')).toBeTruthy();
    expect(ui.queryByText(/al primo colpo/)).toBeNull();
  });
});
