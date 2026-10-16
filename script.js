'use strict';

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const cells = [...document.querySelectorAll('.cell')];
const turnSymbol = document.getElementById('turn-symbol');
const turnText = document.getElementById('turn-text');
const turnPill = document.getElementById('turn-pill');
const turnBanner = document.getElementById('turn-banner');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraw = document.getElementById('score-draw');
const playAgainButton = document.getElementById('play-again');
const resetGameButton = document.getElementById('reset-game');
const resetScoresButton = document.getElementById('reset-scores');
const soundToggleButton = document.getElementById('sound-toggle');
const soundLabel = document.getElementById('sound-label');
const hintButton = document.getElementById('hint-button');
const hintFeedback = document.getElementById('hint-feedback');
const moveCountLabel = document.getElementById('move-count');
const moveProgress = document.getElementById('move-progress');
const winnerModal = document.getElementById('winner-modal');
const winnerDialog = winnerModal?.querySelector('.winner-dialog');
const winnerBadge = document.getElementById('winner-badge');
const winnerKicker = document.getElementById('winner-kicker');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');
const winnerMoveSummary = document.getElementById('winner-move-summary');
const winnerScoreSummary = document.getElementById('winner-score-summary');
const modalNextRound = document.getElementById('modal-next-round');
const modalBack = document.getElementById('modal-back');
const modalClose = document.getElementById('winner-close');
const confettiLayer = document.getElementById('confetti-layer');

let board = Array(9).fill('');
let currentPlayer = 'X';
let roundOver = false;
let moveCount = 0;
let hintedIndex = null;
let hintTimeout = null;
let scores = { X: 0, O: 0, draw: 0 };
let soundEnabled = false;
let audioContext = null;
let returnFocusElement = null;
let modalIsOpen = false;

function findWinningLine(state = board) {
  return WINNING_LINES.find(([a, b, c]) => state[a] && state[a] === state[b] && state[a] === state[c]) || null;
}

function hasWinningMove(player) {
  return board.some((mark, index) => {
    if (mark) return false;
    const candidate = [...board];
    candidate[index] = player;
    return Boolean(findWinningLine(candidate));
  });
}

function winningMoveIndex(player) {
  for (let index = 0; index < board.length; index += 1) {
    if (board[index]) continue;
    const candidate = [...board];
    candidate[index] = player;
    if (findWinningLine(candidate)) return index;
  }
  return -1;
}

function updateTurnBanner(message, pillText, gameOver = false) {
  turnSymbol.textContent = currentPlayer;
  turnSymbol.className = `turn-symbol ${currentPlayer === 'X' ? 'x-symbol' : 'o-symbol'}`;
  turnText.textContent = message;
  turnPill.textContent = pillText;
  turnBanner.classList.toggle('is-over', gameOver);
}

function updateMoveProgress() {
  if (moveCountLabel) moveCountLabel.textContent = `${moveCount} / 9 MOVES`;
  if (moveProgress) moveProgress.style.width = `${(moveCount / 9) * 100}%`;
}

function clearHint() {
  window.clearTimeout(hintTimeout);
  hintedIndex = null;
  cells.forEach((cell) => cell.classList.remove('hint-cell'));
}

function renderBoard(winningLine = []) {
  cells.forEach((cell, index) => {
    const mark = board[index];
    cell.textContent = mark;
    cell.classList.toggle('mark-x', mark === 'X');
    cell.classList.toggle('mark-o', mark === 'O');
    cell.classList.toggle('winning-cell', winningLine.includes(index));
    cell.classList.toggle('hint-cell', hintedIndex === index && !mark && !roundOver);
    cell.disabled = roundOver || Boolean(mark);
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    cell.setAttribute('aria-label', `Row ${row}, column ${column}, ${mark || (hintedIndex === index ? 'suggested move' : 'empty')}`);
  });
  updateMoveProgress();
}

function updateScores() {
  scoreX.textContent = scores.X;
  scoreO.textContent = scores.O;
  scoreDraw.textContent = scores.draw;
}

function playTone(frequency, duration = 0.12, wave = 'sine', volume = 0.035, delay = 0) {
  if (!soundEnabled) return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext = audioContext || new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startAt = audioContext.currentTime + delay;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  } catch (error) {
    // Sound is optional; if the browser blocks audio, the game continues silently.
  }
}

function playWinSequence() {
  [523, 659, 784].forEach((frequency, index) => playTone(frequency, 0.22, 'triangle', 0.045, index * 0.12));
}

function updateResultSummary() {
  if (winnerMoveSummary) winnerMoveSummary.textContent = `${moveCount} ${moveCount === 1 ? 'MOVE' : 'MOVES'} PLAYED`;
  if (winnerScoreSummary) winnerScoreSummary.textContent = `X ${scores.X} — ${scores.O} O`;
}

function clearConfetti() {
  if (confettiLayer) confettiLayer.replaceChildren();
}

function throwConfetti() {
  if (!confettiLayer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clearConfetti();
  const palette = ['#63caff', '#ffe28a', '#ffffff', '#367bf5', '#ffd166'];
  for (let i = 0; i < 34; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
    piece.style.setProperty('--confetti-color', palette[i % palette.length]);
    piece.style.setProperty('--confetti-delay', `${Math.random() * 0.45}s`);
    piece.style.setProperty('--confetti-duration', `${2.2 + Math.random() * 1.5}s`);
    piece.style.setProperty('--confetti-drift', `${Math.round(Math.random() * 150 - 75)}px`);
    piece.style.setProperty('--confetti-spin', `${Math.round(Math.random() * 900 + 180)}deg`);
    piece.style.setProperty('--confetti-width', `${5 + Math.random() * 5}px`);
    piece.style.setProperty('--confetti-height', `${8 + Math.random() * 8}px`);
    confettiLayer.appendChild(piece);
  }
}

function showResultModal(type) {
  if (!winnerModal || !winnerDialog) return;
  returnFocusElement = document.activeElement;
  const won = type === 'X' || type === 'O';
  winnerBadge.className = `winner-badge ${won ? `winner-${type.toLowerCase()}` : 'winner-draw'}`;
  winnerBadge.textContent = won ? type : '＝';
  winnerKicker.textContent = won ? 'VICTORY CONFIRMED' : 'DEAD EVEN';
  winnerTitle.textContent = won ? `Player ${type} won!` : 'It’s a draw!';
  winnerMessage.textContent = won
    ? `Three in a row. Player ${type} takes this round — beautifully played.`
    : 'No one takes this round. Reset, rethink, and go again.';
  updateResultSummary();
  clearConfetti();
  if (won) throwConfetti();
  winnerModal.hidden = false;
  winnerModal.setAttribute('aria-hidden', 'false');
  modalIsOpen = true;
  requestAnimationFrame(() => winnerModal.classList.add('is-open'));
  window.setTimeout(() => modalNextRound?.focus(), 80);
}

function closeResultModal(restoreFocus = true) {
  if (!winnerModal || winnerModal.hidden) return;
  winnerModal.classList.remove('is-open');
  winnerModal.setAttribute('aria-hidden', 'true');
  modalIsOpen = false;
  window.setTimeout(() => {
    if (!winnerModal.classList.contains('is-open')) winnerModal.hidden = true;
    clearConfetti();
  }, 240);
  if (restoreFocus) {
    window.setTimeout(() => (playAgainButton || returnFocusElement)?.focus(), 20);
  }
}

function makeMove(index) {
  if (roundOver || board[index] || index < 0 || index > 8) return;
  clearHint();
  if (hintFeedback) hintFeedback.textContent = 'Nice move. Watch the lines and protect your corners.';
  board[index] = currentPlayer;
  moveCount += 1;
  playTone(currentPlayer === 'X' ? 523 : 392, 0.1, 'sine', 0.03);

  const winningLine = findWinningLine();
  if (winningLine) {
    roundOver = true;
    scores[currentPlayer] += 1;
    updateScores();
    renderBoard(winningLine);
    updateTurnBanner(`Player ${currentPlayer} wins!`, 'ROUND WON', true);
    playAgainButton.innerHTML = 'Play next round <span aria-hidden="true">↗</span>';
    playWinSequence();
    showResultModal(currentPlayer);
    return;
  }

  if (board.every(Boolean)) {
    roundOver = true;
    scores.draw += 1;
    updateScores();
    renderBoard();
    updateTurnBanner('It’s a draw!', 'WELL PLAYED', true);
    playAgainButton.innerHTML = 'Play next round <span aria-hidden="true">↗</span>';
    playTone(260, 0.22, 'triangle', 0.035);
    showResultModal('draw');
    return;
  }

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  renderBoard();
  updateTurnBanner(`Player ${currentPlayer}'s turn`, 'YOUR MOVE');
}

function startNewRound() {
  closeResultModal(false);
  board = Array(9).fill('');
  currentPlayer = 'X';
  roundOver = false;
  moveCount = 0;
  clearHint();
  clearConfetti();
  if (hintFeedback) hintFeedback.textContent = 'Need a nudge? Try Strategy hint.';
  renderBoard();
  updateTurnBanner("Player X's turn", 'YOUR MOVE');
  playAgainButton.innerHTML = 'Play again <span aria-hidden="true">↗</span>';
}

function resetAllScores() {
  scores = { X: 0, O: 0, draw: 0 };
  updateScores();
  startNewRound();
  if (hintFeedback) hintFeedback.textContent = 'Scoreboard cleared. First move is yours.';
}

function showStrategyHint() {
  if (roundOver) {
    if (hintFeedback) hintFeedback.textContent = 'This round is complete. Start the next round to get another hint.';
    return;
  }
  clearHint();
  let index = -1;
  let message = '';
  const opponent = currentPlayer === 'X' ? 'O' : 'X';

  index = winningMoveIndex(currentPlayer);
  if (index !== -1) {
    message = `Winning chance: Player ${currentPlayer} can complete a line here.`;
  } else {
    index = winningMoveIndex(opponent);
    if (index !== -1) {
      message = `Defend now: block Player ${opponent} from completing a line.`;
    } else if (!board[4]) {
      index = 4;
      message = 'Try the center. It connects to four possible winning lines.';
    } else {
      const availableCorner = [0, 2, 6, 8].find((position) => !board[position]);
      if (availableCorner !== undefined) {
        index = availableCorner;
        message = 'Try a corner. Corners create useful diagonal opportunities.';
      } else {
        index = board.findIndex((mark) => !mark);
        message = 'Keep the pressure on and choose an open square.';
      }
    }
  }

  if (index < 0) {
    if (hintFeedback) hintFeedback.textContent = 'No moves left in this round.';
    return;
  }
  hintedIndex = index;
  renderBoard(findWinningLine() || []);
  cells[index].classList.add('hint-cell');
  if (hintFeedback) hintFeedback.textContent = message;
  playTone(740, 0.11, 'sine', 0.025);
  hintTimeout = window.setTimeout(() => {
    hintedIndex = null;
    renderBoard(findWinningLine() || []);
  }, 3600);
}

// Game controls.
cells.forEach((cell) => cell.addEventListener('click', () => makeMove(Number(cell.dataset.index))));
playAgainButton.addEventListener('click', () => { startNewRound(); cells[0].focus(); });
resetGameButton.addEventListener('click', startNewRound);
resetScoresButton.addEventListener('click', resetAllScores);
hintButton?.addEventListener('click', showStrategyHint);
soundToggleButton?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleButton.setAttribute('aria-pressed', String(soundEnabled));
  soundToggleButton.classList.toggle('sound-on', soundEnabled);
  if (soundLabel) soundLabel.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  soundToggleButton.title = soundEnabled ? 'Turn sound effects off' : 'Turn sound effects on';
  if (soundEnabled) playTone(660, 0.12, 'triangle', 0.035);
});
modalNextRound?.addEventListener('click', () => { closeResultModal(false); startNewRound(); cells[0].focus(); });
modalBack?.addEventListener('click', () => closeResultModal(true));
modalClose?.addEventListener('click', () => closeResultModal(true));
winnerModal?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.dismissWinner === 'true') closeResultModal(true);
});
document.addEventListener('keydown', (event) => {
  if (!modalIsOpen) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeResultModal(true);
  } else if (event.key === 'Tab' && winnerModal && winnerDialog) {
    const focusable = [...winnerDialog.querySelectorAll('button:not(:disabled)')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
});

renderBoard();
updateScores();
updateTurnBanner("Player X's turn", 'YOUR MOVE');

// Typewriter hero headline.
const typedLine = document.getElementById('typed-line');
const fullHeroPhrase = 'Big Strategy.';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (typedLine) {
  if (reduceMotion) {
    typedLine.textContent = fullHeroPhrase;
  } else {
    let characterIndex = 0;
    const typeNextCharacter = () => {
      typedLine.textContent = fullHeroPhrase.slice(0, characterIndex);
      characterIndex += 1;
      if (characterIndex <= fullHeroPhrase.length) {
        window.setTimeout(typeNextCharacter, characterIndex < 5 ? 105 : 62);
      }
    };
    window.setTimeout(typeNextCharacter, 450);
  }
}

// Reveal the game and rule cards as the visitor scrolls.
const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

// Keep the footer year current.
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// Intro splash plays on page load. Visitors can skip it immediately.
const introScreen = document.getElementById('intro-screen');
const introSkipButton = document.getElementById('intro-skip');
if (introScreen) {
  let introFinished = false;
  let introTimer;
  const finishIntro = () => {
    if (introFinished) return;
    introFinished = true;
    window.clearTimeout(introTimer);
    introScreen.classList.add('is-leaving');
    document.body.classList.remove('is-loading');
    window.setTimeout(() => introScreen.remove(), 750);
  };
  introSkipButton?.addEventListener('click', finishIntro);
  introTimer = window.setTimeout(finishIntro, reduceMotion ? 350 : 2700);
}
