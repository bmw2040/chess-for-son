import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function App() {
  const [game, setGame] = useState(new Chess());

  function onDrop(sourceSquare: string, targetSquare: string) {
    const gameCopy = new Chess(game.fen());

    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });

    if (move === null) {
      return false;
    }

    setGame(gameCopy);
    return true;
  }

  return (
    <div style={{ width: "600px", margin: "20px auto" }}>
      <h1>유준의 체스</h1>

      <p>
        현재 차례 : {game.turn() === "w" ? "백" : "흑"}
      </p>

      <Chessboard
        position={game.fen()}
        onPieceDrop={onDrop}
      />
    </div>
  );
}