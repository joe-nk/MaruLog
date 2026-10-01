/*
 * Optional local defaults. Edit this file to change the initial scoreboard
 * without touching app.js. Values saved in localStorage take precedence.
 */
window.QUIZ_CONFIG = {
  mode: "custom",
  rule: "count",
  correctIndex: 0,
  incorrectIndex: 1,
  nyCorrectWeightIndex: 2,
  nyIncorrectWeightIndex: 3,
  tenByTenBaseIndex: 4,
  sevenBySevenBaseIndex: 5,
  freezeIndex: 6,
  displayTemplate: "${data[0]}〇${data[1]}×",
  initialData: {
    2: 1,
    3: 1,
    4: 10,
    5: 7,
    6: 0
  },
  hooks: {
    correct: "(# $correct (+ (@ $correct) 1))",
    incorrect: "(# $incorrect (+ (@ $incorrect) 1))",
    through: "(# $correct (@ $correct))"
  },
  dark: false
};
