import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";


export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState<string[]>([]);
const [moves, setMoves] = useState<string[]>([]);
const [aiElo, setAiElo] = useState(600);
const [aiThinking, setAiThinking] = useState(false);
  const engineRef = useRef<Worker | null>(null);
  const pendingGameRef = useRef<Chess | null>(null);



  const [lastMove, setLastMove] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const [moveSquares, setMoveSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
useEffect(() => {
  console.log("Stockfish Init Start");

  const worker = new Worker("/stockfish.js");

  console.log("Worker Created");

  engineRef.current = worker;

worker.onmessage = (event) => {
  const text = event.data;

  console.log("STOCKFISH:", text);

  if (
    typeof text === "string" &&
    text.startsWith("bestmove")
  ) {
    const moveStr = text.split(" ")[1];
    console.log("AI MOVE =", moveStr);

    if (
      !moveStr ||
      moveStr === "(none)" ||
      !pendingGameRef.current
    ) {
      return;
    }

    const gameCopy = new Chess(
      pendingGameRef.current.fen()
    );

const result = gameCopy.move({
  from: moveStr.substring(0, 2) as any,
  to: moveStr.substring(2, 4) as any,
  promotion: "q",
});
console.log("MOVE RESULT =", result);
if (result) {
  setMoves((prev) => [...prev, result.san]);
  setHistory((prev) => [
  ...prev,
  pendingGameRef.current!.fen(),
]);
}

setGame(gameCopy);
setAiThinking(false);
  }
};

  worker.onerror = (error) => {
    console.error("STOCKFISH ERROR:", error);
  };

  worker.postMessage("uci");
  worker.postMessage("isready");

  return () => {
    worker.terminate();
  };
}, []);
  function showMoveOptions(square: string) {
    try {
      const moves = game.moves({
        square,
        verbose: true,
      });

        //console.log(square);
  //console.log(moves);

      if (moves.length === 0) {
        setMoveSquares({});
        return;
      }

      const newSquares: Record<
        string,
        React.CSSProperties
      > = {};

      moves.forEach((move: any) => {
        newSquares[move.to] = {
          background:
            "radial-gradient(circle, rgba(0,0,0,0.35) 20%, transparent 22%)",
          borderRadius: "50%",
        };
      });

      setMoveSquares(newSquares);
    } catch {
      setMoveSquares({});
    }
  }

  function onDrop(
    sourceSquare: string,
    targetSquare: string
  ) {
    const gameCopy = new Chess(game.fen());

    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      setMoves((prev) => [...prev, move.san]);

      setHistory((prev) => [
        ...prev,
        game.fen(),
      ]);

      setLastMove({
        from: sourceSquare,
        to: targetSquare,
      });

      setMoveSquares({});

      setGame(gameCopy);
      setAiThinking(true);

setTimeout(() => {
  requestAIMove(gameCopy);
}, 300);

      return true;
    } catch {
      return false;
    }
  }

function resetGame() {
  setGame(new Chess());
  setHistory([]);
  setMoves([]);
  setLastMove(null);
  setMoveSquares({});
}

  function undoMove() {
    if (history.length === 0) return;

    if (history.length === 1) {
      setGame(new Chess(history[0]));
      setHistory([]);
      setLastMove(null);
      setMoveSquares({});
      return;
    }

    const previousFen =
      history[history.length - 2];

    setGame(new Chess(previousFen));

    setHistory((prev) =>
      prev.slice(0, prev.length - 2)
    );

    setMoves((prev) =>
  prev.slice(0, prev.length - 2)
);

    setLastMove(null);
    setMoveSquares({});
  }
function requestAIMove(currentGame: Chess) {
  if (!engineRef.current) return;

  pendingGameRef.current = currentGame;

  engineRef.current.postMessage("ucinewgame");

  engineRef.current.postMessage(
    `position fen ${currentGame.fen()}`
  );

  engineRef.current.postMessage(
  "setoption name UCI_LimitStrength value true"
);

engineRef.current.postMessage(
  `setoption name UCI_Elo value ${aiElo}`
);
  engineRef.current.postMessage(
    `setoption name Skill Level value ${Math.min(
      20,
      Math.floor(aiElo / 150)
    )}`
  );

  engineRef.current.postMessage("go movetime 500");
}


  function getCapturedPieces() {
  const moves = game.history({ verbose: true });

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  moves.forEach((move) => {
    if (move.captured) {
      if (move.color === "w") {
        whiteCaptured.push(move.captured);
      } else {
        blackCaptured.push(move.captured);
      }
    }
  });

  return {
    whiteCaptured,
    blackCaptured,
  };
}

function pieceToSymbol(piece: string) {
  const symbols: Record<string, string> = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
  };

  return symbols[piece] || piece;
}

  const customSquareStyles = {
    ...(lastMove
      ? {
          [lastMove.from]: {
            backgroundColor:
              "rgba(255,255,0,0.45)",
          },
          [lastMove.to]: {
            backgroundColor:
              "rgba(255,255,0,0.45)",
          },
        }
      : {}),

    ...moveSquares,
  };

  const captured = getCapturedPieces();

  const movePairs: {
  number: number;
  white: string;
  black: string;
}[] = [];

for (let i = 0; i < moves.length; i += 2) {
  movePairs.push({
    number: i / 2 + 1,
    white: moves[i],
    black: moves[i + 1] || "",
  });
}

  return (
    <div className="app">
      <h1>유준의 체스</h1>

      <div className="toolbar">
        <button onClick={resetGame}>
          새 게임
        </button>

        <button
          onClick={undoMove}
          disabled={history.length === 0}
        >
          무르기
        </button>
<label
  style={{
    marginLeft: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }}
>
  AI Elo

  <input
    type="number"
    min="100"
    max="3000"
    step="100"
    value={aiElo}
    onChange={(e) =>
      setAiElo(
        Number(e.target.value)
      )
    }
    style={{
      width: "90px",
      padding: "6px",
    }}
  />
</label>

      </div>
<p>
  현재 AI 레벨 : {aiElo}
</p>
{aiThinking && (
  <p
    style={{
      color: "orange",
      fontWeight: "bold",
    }}
  >
    🤖 AI 생각중...
  </p>
)}
<p className="turn">
  현재 차례 :
  {game.turn() === "w"
    ? " 백"
    : " 흑"}
</p>

      {game.inCheck() &&
        !game.isCheckmate() && (
          <p className="check">
            ⚠ 체크!
          </p>
        )}

      {game.isCheckmate() && (
        <p className="mate">
          🏆 게임 종료!
          {game.turn() === "w"
            ? " 흑 승리"
            : " 백 승리"}
        </p>
      )}

      {game.isDraw() &&
        !game.isCheckmate() && (
          <p className="draw">
            🤝 무승부
          </p>
        )}

<div className="game-area">

  <div className="board">
    <Chessboard
      position={game.fen()}
      onPieceDrop={onDrop}
      onSquareClick={(square) =>
        showMoveOptions(square)
      }
      customSquareStyles={
        customSquareStyles
      }
    />
  </div>

  <div className="side-panel">

    <div className="captured-panel">
      <h3>잡힌 말</h3>

      <strong>백이 잡은 말</strong>

      <div className="captured-pieces">
        {captured.whiteCaptured.map(
          (piece, index) => (
            <span key={index}>
              {pieceToSymbol(piece)}
            </span>
          )
        )}
      </div>

      <strong>흑이 잡은 말</strong>

      <div className="captured-pieces">
        {captured.blackCaptured.map(
          (piece, index) => (
            <span key={index}>
              {pieceToSymbol(piece)}
            </span>
          )
        )}
      </div>
    </div>

    <div className="pgn-panel">
      <h3>기보</h3>

      {movePairs.map((pair) => (
        <div
          key={pair.number}
          className="move-row"
        >
          <span>{pair.number}.</span>

          <span>{pair.white}</span>

          <span>{pair.black}</span>
        </div>
      ))}
    </div>

  </div>

</div>


    </div>
  );
}