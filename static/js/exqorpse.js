/**
 * exQorpse.com — Archival Simulation Engine
 * Recreates the original 2006 PHP/MySQL game as client-side JS
 * powered by static JSON data files.
 *
 * Original: Shawn Rider, June 2006
 * Archival conversion: 2026
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    nickname: '',
    uid: null,
    callCount: 0,
    roomCount: 0,
    gCount: 0,
    gType: '',
    players: [],
    opponents: [],
    spectators: [],
    playerList: '',
    spectatorList: '',
    spectConvo: 'a',
    oldChat: new Set(),
    oldLines: new Set(),
    oldAnswers: new Set(),
    oldQuestions: new Set(),
    chatTimeouts: [],
  };

  const spectConvos = ['a', 'b', 'c', 'd'];

  // --- Data (loaded from JSON) ---
  let DATA = {
    names: [],
    lines: [],
    chat: [],
    qna: [],
  };

  // --- Tips (from original PHP templates) ---
  const questionTips = [
    'Be sure to use your best spelling skills!',
    'Get creative!',
    'Ask the tough questions.',
    'See if you can channel the future in your answers!',
    'Everyone is counting on you to deliver the best!',
    'Get to know your new friends in the chat area.',
    'Chat with your friends about what makes a good poem.',
    'What questions do you have today?',
    'Get a question ready: Everyone must contribute!',
    'There are lots of games to play -- keep writing!',
    'Creativity can be so tough!',
    'Help out your fellow players.',
    'Be kind to your new friends.',
    'Offer encouragement to other players.',
    'Good lines will be praised in the chat area.',
    'See what others think of your work.',
    'Listen to feedback in order to improve your creativity!',
    'Everyone benefits from constructive criticism.',
    'Still confused? Check the FAQs!',
    'Grouchy players make no friends!',
    'Stretch your brain!',
    'Can you feel yourself getting smarter?',
  ];

  const verseTips = [
    'Be sure to use your best spelling skills!',
    'Get creative!',
    'Always write your best line.',
    'Be encouraging to other players!',
    'Help new players get better.',
    'Always show your happy game face!',
    'Get to know your new friends in the chat box.',
    'Which lines do you like best?',
    'Offer compliments to your new friends!',
    'You can always change rooms if things go sour!',
    'Need some new scenery? Change rooms!',
    'Be sure to check the FAQs if you see something unusual.',
    'Got a meanie in your group? Change rooms!',
    'Greet new users warmly.',
    'Please refrain from damaging or rude language, except for artistic effect.',
    'Discuss your favorite poems in the chat area.',
    'Read the chat and you may discover new poets to read.',
    'Do all poems have to rhyme?',
    'Let us get surreal!',
    'Strange poems rule!',
    'Wacky is lame, whimsical is great!',
    'Play safe: Always wear your thinking cap!',
    'Make friends with the people in your game room.',
  ];

  // --- Utility ---
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Data Loading ---
  async function loadData() {
    const files = ['names', 'lines', 'chat', 'qna'];
    const results = await Promise.all(
      files.map((f) => fetch(`/data/${f}.json`).then((r) => r.json()))
    );
    DATA.names = results[0];
    DATA.lines = results[1];
    DATA.chat = results[2];
    DATA.qna = results[3];
  }

  // --- Show latest Q&A and verse on page load ---
  function showLatest() {
    // Latest verse (4 random lines)
    const verseLines = shuffle([...DATA.lines]).slice(0, 4);
    const verseHtml = verseLines
      .map((l) => escapeHtml(l.line.charAt(0).toUpperCase() + l.line.slice(1)))
      .join('<br>');
    const latestV = document.getElementById('latestV');
    if (latestV) latestV.innerHTML = '<p>' + verseHtml + '</p>';

    // Latest question (1 question + 3 answers)
    const questions = DATA.qna.filter((q) => q.type === 'q');
    const answers = DATA.qna.filter((q) => q.type === 'a');
    const q = pick(questions);
    const ans = shuffle([...answers]).slice(0, 3);
    let qHtml =
      '<p><strong>' +
      escapeHtml(q.text.charAt(0).toUpperCase() + q.text.slice(1)) +
      '</strong></p><p>';
    qHtml += ans
      .map((a) =>
        escapeHtml(a.text.charAt(0).toUpperCase() + a.text.slice(1))
      )
      .join('<br>');
    qHtml += '</p>';
    const latestQ = document.getElementById('latestQ');
    if (latestQ) latestQ.innerHTML = qHtml;
  }

  // --- Room Setup ---
  function setupRoom() {
    state.gCount = 0;
    state.gType = '';

    // Pick 3 opponents (not the current player's name, and different from previous opponents)
    const availableNames = DATA.names
      .filter(
        (n) =>
          n.name !== state.nickname &&
          !state.opponents.includes(n.name)
      )
      .map((n) => n.name);

    // If we've exhausted unique names, just pick from all
    const pool =
      availableNames.length >= 3
        ? availableNames
        : DATA.names
            .filter((n) => n.name !== state.nickname)
            .map((n) => n.name);

    state.opponents = shuffle([...pool]).slice(0, 3);
    state.players = shuffle([...state.opponents, state.nickname]);
    state.playerList = state.players.join(', ');

    // Pick 0-5 spectators (not players)
    const spectPool = DATA.names
      .filter(
        (n) => !state.players.includes(n.name)
      )
      .map((n) => n.name);
    const spectCount = randInt(0, 5);
    state.spectators = shuffle([...spectPool]).slice(
      0,
      Math.min(spectCount, spectPool.length)
    );
    state.spectatorList = state.spectators.join(', ');

    // Choose spectator conversation for this room
    state.roomCount++;
    if (state.roomCount > spectConvos.length - 1) {
      state.roomCount = 0;
    }
    state.spectConvo = spectConvos[state.roomCount % spectConvos.length];

    // Render social area
    renderSocial();
    // Render chat area
    renderChat();
  }

  function renderSocial() {
    const socialArea = document.getElementById('socialArea');
    socialArea.innerHTML = `
      <p class="usersPresent"><strong>Players:</strong> ${escapeHtml(state.playerList)}</p>
      <p class="spectators"><strong>Spectators:</strong> ${escapeHtml(state.spectatorList)}</p>
      <p class="changeRoom"><a onclick="window.exQ.newRoom();" style="cursor:pointer;">change to a new room</a></p>
    `;
  }

  function renderChat() {
    const rightSide = document.getElementById('rightSide');
    rightSide.innerHTML = `
      <div id="chatContainer">
        <div id="chatWindow"><p class="chatLine"></p></div>
        <div id="chatEntry">
          <fieldset>
            <legend>enter chat text</legend>
            <form onsubmit="event.preventDefault(); window.exQ.submitChat();">
              <input name="uChat" id="uChat" type="text" size="30">
              <input type="button" value="send" onclick="window.exQ.submitChat();">
            </form>
          </fieldset>
        </div>
      </div>
    `;
  }

  // --- Chat System ---
  function addChat(html) {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    const p = document.createElement('p');
    p.innerHTML = html;
    chatWindow.appendChild(p);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function clearChatTimeouts() {
    state.chatTimeouts.forEach((t) => clearTimeout(t));
    state.chatTimeouts = [];
  }

  function processText(texts) {
    // Replace [user], [npc] placeholders and assign speakers
    shuffle(state.opponents);
    const complimented = state.opponents[0];
    const speaker1 = state.opponents[1] || state.opponents[0];
    const speaker2 = state.opponents[2] || state.opponents[0];

    return texts.map((text, i) => {
      let processed = text
        .replace(/\[user\]/g, '<strong>' + escapeHtml(state.nickname) + '</strong>')
        .replace(/\[npc\]/g, '<strong>' + escapeHtml(complimented) + '</strong>');

      const speaker = i % 2 === 0 ? speaker1 : speaker2;
      return '<p><strong>' + escapeHtml(speaker) + '</strong>: ' + processed + '</p>';
    });
  }

  function processSpectText(texts) {
    const sp1 = state.spectators[0] || state.opponents[0];
    const sp2 = state.spectators[1] || state.opponents[1] || state.opponents[0];
    const sp3 = state.spectators[2] || state.opponents[2] || state.opponents[0];

    return texts.map((text) => {
      return (
        '<p>' +
        text
          .replace(
            /\[sp1\]/g,
            '<strong>' + escapeHtml(sp1) + ': </strong>'
          )
          .replace(
            /\[sp2\]/g,
            '<strong>' + escapeHtml(sp2) + ': </strong>'
          )
          .replace(
            /\[sp3\]/g,
            '<strong>' + escapeHtml(sp3) + ': </strong>'
          )
          .replace(
            /\[spect1\]/g,
            '<strong>' + escapeHtml(sp1) + ': </strong>'
          )
          .replace(
            /\[spect2\]/g,
            '<strong>' + escapeHtml(sp2) + ': </strong>'
          )
          .replace(
            /\[spect3\]/g,
            '<strong>' + escapeHtml(sp3) + ': </strong>'
          ) +
        '</p>'
      );
    });
  }

  function getChat() {
    const chatNum = state.oldChat.size === 0 ? 4 : randInt(1, 3);
    const minLim = state.callCount - 1;

    // Player chat: match by numeric type (callCount or callCount-1)
    let playerChats = DATA.chat.filter(
      (c) =>
        !c.type.startsWith('s') &&
        (c.type === String(state.callCount) ||
          c.type === String(minLim)) &&
        !state.oldChat.has(c.id)
    );

    // If nothing left, reset and try again
    if (playerChats.length === 0) {
      state.oldChat = new Set();
      playerChats = DATA.chat.filter(
        (c) =>
          !c.type.startsWith('s') &&
          parseInt(c.type) <= state.callCount &&
          parseInt(c.type) >= minLim
      );
    }

    shuffle(playerChats);
    const selectedPlayer = playerChats.slice(0, chatNum);
    selectedPlayer.forEach((c) => state.oldChat.add(c.id));

    // Process and display player chat with delays
    const playerTexts = selectedPlayer.map((c) => c.text);
    const processed = processText(playerTexts);
    processed.forEach((html) => {
      const delay = randInt(3000, 15000);
      const t = setTimeout(() => addChat(html), delay);
      state.chatTimeouts.push(t);
    });

    // Spectator chat
    if (state.spectators.length > 1) {
      const spectLevel = 's' + state.callCount + state.spectConvo;
      const spectChats = DATA.chat
        .filter((c) => c.type === spectLevel && !state.oldChat.has(c.id))
        .sort((a, b) => a.id - b.id);

      spectChats.forEach((c) => state.oldChat.add(c.id));

      const spectTexts = spectChats.map((c) => c.text);
      const spectProcessed = processSpectText(spectTexts);
      let delay = 0;
      spectProcessed.forEach((html) => {
        delay += randInt(5000, 10000);
        const t = setTimeout(() => addChat(html), delay);
        state.chatTimeouts.push(t);
      });
    }
  }

  // --- Game Setup ---
  function setupGame() {
    state.gCount++;
    // Randomly choose questions or verses
    state.gType = Math.random() < 0.5 ? 'questions' : 'verses';

    if (state.gType === 'questions') {
      renderQuestionsGame();
    } else {
      renderVersesGame();
    }

    // Trigger chat
    getChat();
  }

  function renderQuestionsGame() {
    const tips = shuffle([...questionTips]);

    // Determine if player asks the question (every 4th game)
    const isQuestioner = state.gCount % 4 === 0;

    let formHtml;
    if (isQuestioner) {
      formHtml = `
        <div id="questionArea" class="unknown">
          <fieldset>
            <legend>enter your question</legend>
            <form onsubmit="event.preventDefault(); window.exQ.submitQuestion();">
              <input name="uQuestion" id="uQuestion" type="text" size="40"><br>
              <input type="button" value="send question" onclick="window.exQ.submitQuestion();">
            </form>
          </fieldset>
          <p class="help">Enter any question in the box above, and your new friends will supply a poetic answer. It may not be the most correct answer, but it will be crazy fun!</p>
        </div>`;
    } else {
      formHtml = `
        <div id="questionArea" class="unknown">
          <fieldset>
            <legend>enter your answer</legend>
            <form onsubmit="event.preventDefault(); window.exQ.submitAnswer();">
              <input name="uAnswer" id="uAnswer" type="text" size="40"><br>
              <input type="button" value="send answer" onclick="window.exQ.submitAnswer();">
            </form>
          </fieldset>
          <p class="help">Enter an answer to the question supplied by one of your new friends. You don't know the question yet, so don't be worried about whether or not your answer is correct. It's crazy fun!</p>
        </div>`;
    }

    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML = `
      <p class="userMeta">Logged in as <strong>${escapeHtml(state.nickname)}</strong> | game type: <strong>questions</strong></p>
      ${formHtml}
      <div id="lines"><p>TIP: ${escapeHtml(tips[0])}</p></div>
    `;
  }

  function renderVersesGame() {
    const tips = shuffle([...verseTips]);

    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML = `
      <p class="userMeta">Logged in as <strong>${escapeHtml(state.nickname)}</strong> | game type: <strong>verses</strong></p>
      <div id="questionArea" class="unknown">
        <fieldset>
          <legend>enter your line</legend>
          <form onsubmit="event.preventDefault(); window.exQ.submitLine();">
            <input name="uLine" id="uLine" type="text" size="40"><br>
            <input type="button" value="send" onclick="window.exQ.submitLine();">
          </form>
        </fieldset>
      </div>
      <p class="help">You and your new friends are collaborating on a poem! It can be about anything you want. Just enter your line of verse above. It's crazy fun!</p>
      <div id="lines"><p>TIP: ${escapeHtml(tips[0])}</p></div>
    `;
  }

  // --- Submit Handlers ---
  function submitQuestion() {
    const input = document.getElementById('uQuestion');
    if (!input || !input.value.trim()) return;
    const userQuestion = input.value.trim();

    state.callCount++;

    // Get 3 random answers from the database
    const answers = DATA.qna.filter(
      (q) => q.type === 'a' && !state.oldAnswers.has(q.id)
    );
    const selected = shuffle([...answers]).slice(0, 3);
    selected.forEach((a) => state.oldAnswers.add(a.id));

    let linesHtml = '<ul id="answerLines">';
    selected.forEach((a, i) => {
      const opponent = state.opponents[i] || state.opponents[0];
      linesHtml += `<li>${escapeHtml(a.text)} <span style="font-size:small;font-weight:bold;color:#cccccc;">(${escapeHtml(opponent)})</span></li>`;
    });
    linesHtml += `</ul><div id="playAgain"><a onclick="window.exQ.newGame();" style="cursor:pointer;">play again</a></div>`;

    document.getElementById('questionArea').innerHTML =
      '<p style="font-weight:bold;font-size:large;color:#FF00FF;">' +
      escapeHtml(userQuestion) +
      '</p>';
    document.getElementById('lines').innerHTML = linesHtml;

    getChat();
  }

  function submitAnswer() {
    const input = document.getElementById('uAnswer');
    if (!input || !input.value.trim()) return;
    const userAnswer = input.value.trim();

    state.callCount++;

    // Get a random question
    const questions = DATA.qna.filter(
      (q) => q.type === 'q' && !state.oldQuestions.has(q.id)
    );
    if (questions.length === 0) state.oldQuestions = new Set();
    const questionsPool =
      questions.length > 0
        ? questions
        : DATA.qna.filter((q) => q.type === 'q');
    const question = pick(questionsPool);
    state.oldQuestions.add(question.id);

    // Get 2 random answers from database + user's answer
    const answers = DATA.qna.filter(
      (q) => q.type === 'a' && !state.oldAnswers.has(q.id)
    );
    const selected = shuffle([...answers]).slice(0, 2);
    selected.forEach((a) => state.oldAnswers.add(a.id));

    let linesHtml = '<ul id="answerLines">';
    selected.forEach((a, i) => {
      const opponent = state.opponents[i] || state.opponents[0];
      linesHtml += `<li>${escapeHtml(a.text)} <span style="font-size:small;font-weight:bold;color:#cccccc;">(${escapeHtml(opponent)})</span></li>`;
    });
    linesHtml += `<li>${escapeHtml(userAnswer)} <span style="font-size:small;font-weight:bold;">(${escapeHtml(state.nickname)})</span></li>`;
    linesHtml += `</ul><div id="playAgain"><a onclick="window.exQ.newGame();" style="cursor:pointer;">play again</a></div>`;

    document.getElementById('questionArea').innerHTML =
      '<p style="font-weight:bold;font-size:large;color:#FF00FF;">' +
      escapeHtml(question.text) +
      '</p>';
    document.getElementById('lines').innerHTML = linesHtml;

    getChat();
  }

  function submitLine() {
    const input = document.getElementById('uLine');
    if (!input || !input.value.trim()) return;
    const userLine = input.value.trim();

    state.callCount++;

    // Get 3 random lines from database
    const lines = DATA.lines.filter((l) => !state.oldLines.has(l.id));
    const selected = shuffle([...lines]).slice(0, 3);
    selected.forEach((l) => state.oldLines.add(l.id));

    // Build all 4 lines (3 db + 1 user), then shuffle
    const allLines = [];
    selected.forEach((l, i) => {
      const opponent = state.opponents[i] || state.opponents[0];
      allLines.push(
        `<li>${escapeHtml(l.line.charAt(0).toUpperCase() + l.line.slice(1))} <span style="font-size:small;font-weight:bold;color:#cccccc;">(${escapeHtml(opponent)})</span></li>`
      );
    });
    allLines.push(
      `<li>${escapeHtml(userLine)} <span style="font-size:small;font-weight:bold;">(${escapeHtml(state.nickname)})</span></li>`
    );
    shuffle(allLines);

    let linesHtml = '<ul id="versesLines">';
    linesHtml += allLines.join('');
    linesHtml += `</ul><div id="playAgain"><a onclick="window.exQ.newGame();" style="cursor:pointer;">play again</a></div>`;

    document.getElementById('questionArea').innerHTML = '';
    document.getElementById('lines').innerHTML = linesHtml;

    getChat();
  }

  function submitChat() {
    const input = document.getElementById('uChat');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    addChat(
      '<p class="userChatLine"><strong>' +
        escapeHtml(state.nickname) +
        '</strong>: ' +
        escapeHtml(text) +
        '</p>'
    );
    input.value = '';
  }

  // --- End Game (Ban) ---
  function endGame() {
    // Generate a fake IP for the ban message
    const fakeIP =
      randInt(60, 200) +
      '.' +
      randInt(0, 255) +
      '.' +
      randInt(0, 255) +
      '.' +
      randInt(0, 255);

    const userWarning = `
      <div class="userWarning">
        <p>We regret to inform you that several members of your game room have reported you for inappropriate conduct, vulgar language, or generally disruptive behavior.</p>
        <p>Your actions have caused some of our valuable users to have a negative experience, and as a result we have no choice but to ban you from our service.</p>
        <p align="center">We have recorded the following user information for blocking purposes:<br>
        User nickname: ${escapeHtml(state.nickname)}<br>
        IP Address: ${fakeIP}<br>
        Host Name: ${fakeIP.replace(/\./g, '-')}.cable.provider.net</p>
        <p>Thank you for visiting exQorpse.com</p>
        <p style="margin-top: 20px; text-align: center;">
          <a href="/play/" style="color: #FF00FF; font-weight: bold;">Play again?</a>
          &nbsp;|&nbsp;
          <a href="/" style="color: #FF00FF; font-weight: bold;">Learn about this project</a>
        </p>
      </div>`;

    document.getElementById('leftSide').innerHTML = userWarning;
    document.getElementById('rightSide').innerHTML = '';
    clearChatTimeouts();
  }

  // --- Public API ---
  function userLogin() {
    const nicknameInput = document.getElementById('nickname');
    if (!nicknameInput || !nicknameInput.value.trim()) return;

    state.nickname = nicknameInput.value.trim();
    state.callCount = 1;
    state.roomCount = 0;
    state.oldChat = new Set();
    state.oldAnswers = new Set();
    state.oldQuestions = new Set();
    state.oldLines = new Set();

    setupRoom();
    setupGame();
  }

  function newRoom() {
    clearChatTimeouts();
    state.callCount = 1;
    setupRoom();
    setupGame();
  }

  function newGame() {
    clearChatTimeouts();
    if (state.callCount > 10) {
      endGame();
    } else {
      setupGame();
    }
  }

  function validateLogin() {
    const input = document.getElementById('nickname');
    return input && input.value.trim().length > 0;
  }

  // --- Expose to global scope for onclick handlers ---
  window.exQ = {
    newRoom,
    newGame,
    submitQuestion,
    submitAnswer,
    submitLine,
    submitChat,
  };

  // Make validation functions global (referenced in HTML)
  window.validateLogin = validateLogin;
  window.userLogin = userLogin;

  // --- Init ---
  async function init() {
    await loadData();
    showLatest();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
