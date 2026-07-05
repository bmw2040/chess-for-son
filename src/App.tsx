import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState<string[]>([]);
  const [moves, setMoves] = useState<string[]>([]);
  const [aiElo, setAiElo] = useState(100);
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
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  useEffect(() => {
    console.log("Stockfish Init Start");

    const worker = new Worker("/stockfish.js");

    console.log("Worker Created");

    engineRef.current = worker;

    worker.onmessage = (event) => {
      const text = event.data;

      console.log("STOCKFISH:", text);

      if (typeof text === "string" && text.startsWith("bestmove")) {
        const moveStr = text.split(" ")[1];
        console.log("AI MOVE =", moveStr);

        if (!moveStr || moveStr === "(none)" || !pendingGameRef.current) {
          return;
        }

        const gameCopy = new Chess(pendingGameRef.current.fen());

        let from = moveStr.substring(0, 2);
        let to = moveStr.substring(2, 4);

        const randomChance = getRandomMoveChance(aiElo);

        if (Math.random() < randomChance) {
          const randomMove = getRandomMove(gameCopy);

          if (randomMove) {
            console.log("🎲 랜덤 수 선택");

            from = randomMove.from;
            to = randomMove.to;
          }
        }

        const result = gameCopy.move({
          from: from as any,
          to: to as any,
          promotion: "q",
        });

        console.log("MOVE RESULT =", result);
        if (result) {
          setMoves((prev) => [...prev, result.san]);
          setHistory((prev) => [...prev, pendingGameRef.current!.fen()]);
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
        square: square as any,
        verbose: true,
      });

      //console.log(square);
      //console.log(moves);

      if (moves.length === 0) {
        setMoveSquares({});
        return;
      }

      const newSquares: Record<string, React.CSSProperties> = {};

      moves.forEach((move: any) => {
        const targetPiece = game.get(move.to as any);

        if (targetPiece) {
          // 상대 말을 잡는 칸
          newSquares[move.to] = {
            boxShadow: "inset 0 0 0 5px #ef4444",
            borderRadius: "50%",
          };
        } else {
          // 빈 칸으로 이동
          newSquares[move.to] = {
            background:
              "radial-gradient(circle, rgba(34,197,94,.8) 28%, transparent 30%)",
            borderRadius: "50%",
          };
        }
      });

      setMoveSquares(newSquares);
    } catch {
      setMoveSquares({});
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    const gameCopy = new Chess(game.fen());

    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      setMoves((prev) => [...prev, move.san]);

      setHistory((prev) => [...prev, game.fen()]);

      setLastMove({
        from: sourceSquare,
        to: targetSquare,
      });

      setMoveSquares({});
      setSelectedSquare(null);

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

  function onSquareClick(square: string) {
    if (aiThinking) return;
    if (!selectedSquare) {
      const piece = game.get(square as any);
      if (!piece || piece.color !== game.turn()) return;
      setSelectedSquare(square);
      showMoveOptions(square);
      return;
    }
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setMoveSquares({});
      setSelectedSquare(null);
      return;
    }
    const piece = game.get(square as any);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      showMoveOptions(square);
      return;
    }
    const ok = onDrop(selectedSquare, square);
    if (ok) {
      setSelectedSquare(null);
      setMoveSquares({});
    }
  }

  function resetGame() {
    setGame(new Chess());
    setHistory([]);
    setMoves([]);
    setLastMove(null);
    setMoveSquares({});
    setSelectedSquare(null);
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

    const previousFen = history[history.length - 2];

    setGame(new Chess(previousFen));

    setHistory((prev) => prev.slice(0, prev.length - 2));

    setMoves((prev) => prev.slice(0, prev.length - 2));

    setLastMove(null);
    setMoveSquares({});
  }

  function eloToSkill(elo: number) {
    if (elo <= 400) return 0;
    if (elo <= 600) return 2;
    if (elo <= 800) return 4;
    if (elo <= 1000) return 6;
    if (elo <= 1200) return 8;
    if (elo <= 1500) return 10;
    if (elo <= 1800) return 13;
    if (elo <= 2200) return 16;
    return 20;
  }

  function getRandomMove(currentGame: Chess) {
    const legalMoves = currentGame.moves({ verbose: true });

    if (legalMoves.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * legalMoves.length);

    return legalMoves[randomIndex];
  }

  function getRandomMoveChance(elo: number) {
    if (elo <= 100) return 0.9; // 90%
    if (elo <= 300) return 0.7; // 70%
    if (elo <= 600) return 0.5; // 50%
    if (elo <= 1000) return 0.25; // 25%
    return 0;
  }

  function requestAIMove(currentGame: Chess) {
    const skill = eloToSkill(aiElo);

    if (!engineRef.current) return;

    pendingGameRef.current = currentGame;

    engineRef.current.postMessage(`setoption name Skill Level value ${skill}`);

    engineRef.current.postMessage("ucinewgame");

    engineRef.current.postMessage(`position fen ${currentGame.fen()}`);

    // 생각 시간도 난이도에 맞게 변경
    const thinkTime =
      skill === 0
        ? 5
        : skill <= 2
          ? 20
          : skill <= 5
            ? 50
            : skill <= 10
              ? 150
              : skill <= 15
                ? 500
                : 1500;

    engineRef.current.postMessage(`go movetime ${thinkTime}`);
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
    ...(selectedSquare
      ? {
          [selectedSquare]: {
            backgroundColor: "#60A5FA",
            boxShadow: "inset 0 0 0 4px #2563EB",
            borderRadius: "6px",
          },
        }
      : {}),
    ...(lastMove
      ? {
          [lastMove.from]: {
            backgroundColor: "rgba(255,255,0,0.45)",
          },
          [lastMove.to]: {
            backgroundColor: "rgba(255,255,0,0.45)",
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
        <button onClick={resetGame}>새 게임</button>

        <button onClick={undoMove} disabled={history.length === 0}>
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
            onChange={(e) => setAiElo(Number(e.target.value))}
            style={{
              width: "90px",
              padding: "6px",
            }}
          />
        </label>
      </div>
      <p>현재 AI 레벨 : {aiElo}</p>
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
      <p className="turn">현재 차례 :{game.turn() === "w" ? " 백" : " 흑"}</p>

      {game.inCheck() && !game.isCheckmate() && (
        <p className="check">⚠ 체크!</p>
      )}

      {game.isCheckmate() && (
        <p className="mate">
          🏆 게임 종료!
          {game.turn() === "w" ? " 흑 승리" : " 백 승리"}
        </p>
      )}

      {game.isDraw() && !game.isCheckmate() && (
        <p className="draw">🤝 무승부</p>
      )}

      <div className="game-area">
        <div className="board">
          <Chessboard
            position={game.fen()}
            arePiecesDraggable={false}
            onSquareClick={onSquareClick}
            customSquareStyles={customSquareStyles}
          />
        </div>

        <div className="side-panel">
          <div className="captured-panel">
            <h3>잡힌 말</h3>

            <strong>백이 잡은 말</strong>

            <div className="captured-pieces">
              {captured.whiteCaptured.map((piece, index) => (
                <span key={index}>{pieceToSymbol(piece)}</span>
              ))}
            </div>

            <strong>흑이 잡은 말</strong>

            <div className="captured-pieces">
              {captured.blackCaptured.map((piece, index) => (
                <span key={index}>{pieceToSymbol(piece)}</span>
              ))}
            </div>
          </div>

          <div className="pgn-panel">
            <h3>기보</h3>

            {movePairs.map((pair) => (
              <div key={pair.number} className="move-row">
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
