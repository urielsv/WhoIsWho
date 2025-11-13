'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Trophy, MessageSquare, ArrowRight, CheckCircle, XCircle, HelpCircle, User, ChevronLeft, ChevronRight, Star, X, Sparkles, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionState } from '@/types/game';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const socket = useSocket();
  const roomId = params.roomId as string;
  
  const { 
    roomName, 
    playerId, 
    players, 
    options,
    myBoards,
    gamePhase,
    currentTurnPlayerId,
    mySecretOption,
    lastQuestion,
    myNotes,
    myGuesses,
    setPlayers,
    setOptions,
    setMyBoards,
    updateBoard,
    setGamePhase,
    setCurrentTurnPlayerId,
    setLastQuestion,
    setMyNotes,
    addGuess,
  } = useGameStore();

  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessTargetPlayerId, setGuessTargetPlayerId] = useState<string | null>(null); // Which player we're guessing for
  const [guessStep, setGuessStep] = useState(1); // Multi-step confirmation
  const [showHelp, setShowHelp] = useState(false);
  const [selectedBoardView, setSelectedBoardView] = useState<string | null>(null); // Which of MY boards to view (tracking which player)
  const [gameResults, setGameResults] = useState<any[]>([]);
  const [gameStats, setGameStats] = useState<any>(null);
  
  // Get list of OTHER players (not self) - these are the boards I have
  const otherPlayers = players.filter(p => p.id !== playerId);
  
  // Get the currently selected board's options
  // If board hasn't loaded yet, fall back to master options list
  const currentBoardOptions = selectedBoardView 
    ? (myBoards[selectedBoardView] || options.map(opt => ({ ...opt, state: 'normal' as const })))
    : [];

  const isMyTurn = currentTurnPlayerId === playerId;
  const currentPlayer = players.find(p => p.id === currentTurnPlayerId);
  const myPlayer = players.find(p => p.id === playerId);
  const myOption = options.find(o => o.id === mySecretOption);
  const remainingOptions = options.filter(o => !o.eliminated);
  const hasFinished = myPlayer?.hasFinished || false;
  
  // Get the asks/responds pair from server logic
  // The current turn player is the one ASKING, the other in the pair is RESPONDING
  const activePlayers = players.filter(p => !p.hasFinished);
  const askingPlayer = players.find(p => p.id === currentTurnPlayerId);
  
  // Find the responding player (the other player in the current pair)
  // Server logic: pair is determined by asksRespondsPairIndex, and turns alternate between the two
  // Since we don't have the pair index, we use a heuristic:
  // - If exactly 2 active players, they form the pair
  // - Otherwise, the responder is the other player who has been alternating turns
  let respondingPlayer: typeof players[0] | undefined;
  if (activePlayers.length >= 2 && askingPlayer) {
    if (activePlayers.length === 2) {
      // Simple case: exactly 2 players, the other one is the responder
      respondingPlayer = activePlayers.find(p => p.id !== currentTurnPlayerId);
    } else {
      // Multiple players: find the other player in the current pair
      // Since turns alternate between pair members, we can check recent turn history
      // For now, use a simple heuristic: the next active player (will be refined if needed)
      const askingIndex = activePlayers.findIndex(p => p.id === currentTurnPlayerId);
      if (askingIndex !== -1) {
        // Try to find a player who has been alternating - for now, use next in list
        // This is approximate but should work for most cases
        const respondingIndex = (askingIndex + 1) % activePlayers.length;
        respondingPlayer = activePlayers[respondingIndex];
      }
    }
  }

  useEffect(() => {
    if (!socket || !playerId) {
      router.push('/');
      return;
    }

    // Set default board view to first other player
    if (!selectedBoardView && otherPlayers.length > 0) {
      setSelectedBoardView(otherPlayers[0].id);
    }

    const handleRoomUpdate = (data: any) => {
      setPlayers(data.players);
      setOptions(data.options);
      setGamePhase(data.gamePhase);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
    };

    const handlePlayerBoards = (data: any) => {
      // Receive all my private boards at game start
      setMyBoards(data.boards);
    };

    const handleBoardUpdated = (data: any) => {
      // Update a specific board when I make changes
      updateBoard(data.targetPlayerId, data.options);
    };

    const handleQuestionAsked = (data: any) => {
      setLastQuestion(`${data.playerName} asked a question`);
    };

    const handleTurnChanged = (data: any) => {
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
    };

    const handlePlayerGuessed = (data: any) => {
      // Player made a guess
    };

    const handlePlayerGaveUp = (data: any) => {
      // Player gave up
    };

    const handleGameFinished = (data: any) => {
      // Game finished with results
      if (data?.results) {
        setGameResults(data.results);
      }
      if (data?.stats) {
        setGameStats(data.stats);
      }
    };

    const handlePairRotated = (data: any) => {
      setLastQuestion(`New asking pair: ${data.player1} ↔ ${data.player2}`);
    };

    const handleBoardFinished = (data: any) => {
      // Board was finished - update will come via roomUpdate
    };

    const handlePlayerFinishedAllBoards = (data: any) => {
      // Player finished all boards - update will come via roomUpdate
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('boardFinished', handleBoardFinished);
    socket.on('playerFinishedAllBoards', handlePlayerFinishedAllBoards);
    socket.on('playerBoards', handlePlayerBoards);
    socket.on('boardUpdated', handleBoardUpdated);
    socket.on('questionAsked', handleQuestionAsked);
    socket.on('turnChanged', handleTurnChanged);
    socket.on('playerGuessed', handlePlayerGuessed);
    socket.on('playerGaveUp', handlePlayerGaveUp);
    socket.on('gameFinished', handleGameFinished);
    socket.on('pairRotated', handlePairRotated);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('playerBoards', handlePlayerBoards);
      socket.off('boardUpdated', handleBoardUpdated);
      socket.off('questionAsked', handleQuestionAsked);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('playerGuessed', handlePlayerGuessed);
      socket.off('playerGaveUp', handlePlayerGaveUp);
      socket.off('gameFinished', handleGameFinished);
      socket.off('pairRotated', handlePairRotated);
      socket.off('boardFinished', handleBoardFinished);
      socket.off('playerFinishedAllBoards', handlePlayerFinishedAllBoards);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setMyBoards, updateBoard, setGamePhase, setCurrentTurnPlayerId, setLastQuestion, otherPlayers, selectedBoardView]);

  // No need to request boards - they're already in memory (private to client)

  const handleAskQuestion = () => {
    socket?.emit('askQuestion', { roomId });
  };

  const handleOptionClick = (optionId: string) => {
    if (hasFinished || !selectedBoardView) return;
    
    const option = currentBoardOptions.find(o => o.id === optionId);
    if (!option || option.eliminated) return;

    // Simple toggle: click to discard/undiscard on MY private board for tracking this player
    socket?.emit('cycleOptionState', { 
      roomId, 
      optionId,
      targetPlayerId: selectedBoardView
    });
  };

  const handleMakeFinalGuess = (targetPlayerId: string) => {
    // Don't allow guessing for yourself
    if (targetPlayerId === playerId) {
      alert("You can't guess your own option!");
      return;
    }
    setGuessTargetPlayerId(targetPlayerId);
    setGuessStep(1);
    setShowGuessModal(true);
  };

  const handleNextGuessStep = () => {
    if (guessStep === 1) {
      setGuessStep(2);
    } else if (guessStep === 2) {
      setGuessStep(3);
    }
  };

  const handleSelectGuessOption = (optionId: string) => {
    if (!guessTargetPlayerId) return;
    
    if (guessStep < 3) {
      // Save guess locally for preview
      addGuess(guessTargetPlayerId, optionId);
      handleNextGuessStep();
    } else {
      // Final confirmation - submit the guess
      socket?.emit('makeGuessForPlayer', { 
        roomId, 
        targetPlayerId: guessTargetPlayerId,
        optionId,
        confirmation: 'CONFIRMED'
      });
      
      setShowGuessModal(false);
      setGuessTargetPlayerId(null);
      setGuessStep(1);
    }
  };

  const handleGiveUpOnBoard = (targetPlayerId: string) => {
    if (confirm(`Are you sure you want to give up on ${players.find(p => p.id === targetPlayerId)?.username}'s board? This will mark this board as finished.`)) {
      socket?.emit('giveUpOnBoard', { 
        roomId, 
        targetPlayerId 
      });
    }
  };

  const handleNotesChange = (notes: string) => {
    setMyNotes(notes);
    socket?.emit('updateNotes', { roomId, notes });
  };

  const getOptionStateColor = (state: OptionState | undefined) => {
    switch (state) {
      case 'discarded':
        return 'bg-gray-300 dark:bg-gray-700 opacity-60';
      default:
        return 'bg-card border-border';
    }
  };

  const getOptionStateLabel = (state: OptionState | undefined) => {
    if (state === 'discarded') {
      return 'Discarded';
    }
    return '';
  };

  if (gamePhase === 'finished') {
    // Group results by player
    const resultsByPlayer = new Map<string, any[]>();
    gameResults.forEach((result: any) => {
      if (!resultsByPlayer.has(result.playerId)) {
        resultsByPlayer.set(result.playerId, []);
      }
      resultsByPlayer.get(result.playerId)!.push(result);
    });
    
    const totalCorrect = gameResults.filter((r: any) => r.isCorrect).length;
    const hasWinners = totalCorrect > 0;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl space-y-6">
          {/* Header with Celebration */}
          <Card className="text-center border-4 border-yellow-400 dark:border-yellow-500 shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
                {hasWinners && (
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-red-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              <CardTitle className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Game Complete! 🎉
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {hasWinners 
                  ? `${totalCorrect} Correct ${totalCorrect === 1 ? 'Guess' : 'Guesses'} Across All Boards!`
                  : 'Everyone gave their best shot!'}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Stats Card */}
          {gameStats && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{gameStats.totalPlayers}</div>
                    <div className="text-sm text-muted-foreground">Players</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{gameStats.totalBoards}</div>
                    <div className="text-sm text-muted-foreground">Total Boards</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{gameStats.correctGuesses}</div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{gameStats.gaveUp}</div>
                    <div className="text-sm text-muted-foreground">Gave Up</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results by Player */}
          <div className="space-y-6">
            {Array.from(resultsByPlayer.entries()).map(([resultPlayerId, playerResults]: [string, any[]]) => {
              const player = players.find(p => p.id === resultPlayerId);
              const isMe = resultPlayerId === playerId;
              const playerCorrect = playerResults.filter(r => r.isCorrect).length;
              
              return (
                <Card key={resultPlayerId} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl">
                        {player?.username}
                        {isMe && <span className="ml-2 text-sm text-muted-foreground">(You)</span>}
                      </CardTitle>
                      <Badge variant={playerCorrect > 0 ? "default" : "secondary"} className="text-lg px-4 py-1">
                        {playerCorrect} / {playerResults.length} Correct
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {playerResults.map((result: any, index: number) => {
                        const isWinner = result.isCorrect;
                        
                        return (
                          <Card 
                            key={`${result.playerId}-${result.targetPlayerId}`}
                            className={cn(
                              "transition-all duration-300 hover:scale-105",
                              isWinner && "border-2 border-green-500 dark:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950",
                              !isWinner && !result.gaveUp && "border-2 border-red-300 dark:border-red-700 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950",
                              result.gaveUp && "border-2 border-gray-300 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950 dark:to-slate-950"
                            )}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Guessing: {result.targetPlayerName}
                                {isWinner && (
                                  <Badge className="ml-auto bg-green-500 text-white">
                                    <Star className="w-3 h-3 mr-1" />
                                    Correct!
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="p-2 bg-primary/10 rounded border border-primary/30">
                                <div className="text-xs font-semibold text-primary mb-1">Actual Secret:</div>
                                <div className="text-sm font-bold text-primary">{result.actualSecretText}</div>
                              </div>
                              {result.gaveUp ? (
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <XCircle className="w-3 h-3" />
                                    Gave Up
                                  </div>
                                </div>
                              ) : (
                                <div className={cn(
                                  "p-2 rounded border-2",
                                  isWinner 
                                    ? "bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600" 
                                    : "bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600"
                                )}>
                                  <div className="text-xs font-semibold mb-1 flex items-center gap-2">
                                    {isWinner ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                                        <span className="text-green-700 dark:text-green-300">Your Guess:</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                        <span className="text-red-700 dark:text-red-300">Your Guess:</span>
                                      </>
                                    )}
                                  </div>
                                  <div className={cn(
                                    "text-sm font-medium",
                                    isWinner ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
                                  )}>
                                    {result.guessedOptionText}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={() => router.push('/')} 
                className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                size="lg"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Play Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto py-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {roomName}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </div>
            {askingPlayer && respondingPlayer && (
              <div className="flex items-center justify-center gap-3">
                <Badge variant="default" className="text-sm px-3 py-1">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {askingPlayer.username} asking
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline" className="text-sm px-3 py-1">
                  <User className="w-3 h-3 mr-1" />
                  {respondingPlayer.username} responding
                </Badge>
              </div>
            )}
        </div>

        {showHelp && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                How to Play - Fast Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Asks ↔ Responds Style:</strong>
                <p className="text-muted-foreground mt-1">
                  Two players alternate asking and responding to questions quickly. The active pair rotates every 6 turns to give everyone a chance. No waiting for elimination phase - discard options anytime!
                </p>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Private Detective Boards:</strong>
                <p className="text-muted-foreground mt-1">
                  You have a PRIVATE board for each other player. These are YOUR personal notes that no one else can see. Use them to track who you think each player's secret might be!
                </p>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Quick Discard:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li><strong>Click option:</strong> Toggle discard on your current private board</li>
                  <li><strong>Click again:</strong> Undo discard (back to normal)</li>
                  <li><strong>Switch boards:</strong> Use the tabs to view your boards for different players</li>
                </ul>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Making Guesses:</strong>
                <p className="text-muted-foreground mt-1">
                  Click "Make Guess" on any board to guess which option belongs to that player. You can make one guess per player. Remember, these are YOUR private guesses!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasFinished && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg text-center">
            <CheckCircle className="w-5 h-5 inline mr-2 text-yellow-500" />
            <span className="font-medium">You have finished! Waiting for other players...</span>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Current Turn & Question */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Turn</span>
                  {isMyTurn && <Badge>Your Turn</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Asking/Responding Display */}
                {askingPlayer && respondingPlayer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn(
                      "p-3 rounded-lg border-2 text-center",
                      askingPlayer.id === playerId 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
                    )}>
                      <div className="text-xs font-semibold mb-1 uppercase tracking-wide">Asking</div>
                      <div className="text-base font-bold">{askingPlayer.username}</div>
                      {askingPlayer.id === playerId && (
                        <Badge variant="secondary" className="mt-1 text-xs">You</Badge>
                      )}
                    </div>
                    <div className={cn(
                      "p-3 rounded-lg border-2 text-center",
                      respondingPlayer.id === playerId 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                    )}>
                      <div className="text-xs font-semibold mb-1 uppercase tracking-wide">Responding</div>
                      <div className="text-base font-bold">{respondingPlayer.username}</div>
                      {respondingPlayer.id === playerId && (
                        <Badge variant="secondary" className="mt-1 text-xs">You</Badge>
                      )}
                    </div>
                  </div>
                )}

                {gamePhase === 'question' && isMyTurn && !hasFinished && (
                  <div className="space-y-4">
                    <Button onClick={handleAskQuestion} className="w-full" size="lg">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      I Asked My Question
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                      Ask your question out loud, then click. Turn automatically passes to next player!
                    </p>
                  </div>
                )}

                {gamePhase === 'question' && !isMyTurn && askingPlayer && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">
                      <strong>{askingPlayer.username}</strong> is asking a question...
                    </p>
                    {respondingPlayer && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {respondingPlayer.username} will respond
                      </p>
                    )}
                  </div>
                )}

                {lastQuestion && (
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-lg font-medium">{lastQuestion}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can discard options anytime - no need to wait!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Player Board Carousel */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Player Boards</CardTitle>
                  <CardDescription>
                    View and manage options for different players
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {/* My Private Boards - One for each OTHER player */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  <div className="text-xs text-muted-foreground mr-2 whitespace-nowrap">
                    My Boards:
                  </div>
                  {otherPlayers.map((player) => (
                    <Button
                      key={player.id}
                      variant={selectedBoardView === player.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedBoardView(player.id)}
                      className="whitespace-nowrap"
                    >
                      <User className="w-4 h-4 mr-1" />
                      {player.username}
                      {player.hasFinished && (
                        <CheckCircle className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                  ))}
                </div>

                {/* Options Grid for Selected Board */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-600">
                    <div className="text-sm">
                      <div className="font-semibold text-base mb-1">
                        📋 Tracking: {players.find(p => p.id === selectedBoardView)?.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Your PRIVATE notes about who {players.find(p => p.id === selectedBoardView)?.username}'s secret might be
                      </div>
                    </div>
                    {selectedBoardView && (
                      <div className="flex gap-2">
                        {myPlayer?.boardStatus?.[selectedBoardView] ? (
                          <Badge variant={myPlayer.boardStatus[selectedBoardView] === 'guessed' ? "default" : "secondary"} className="px-3 py-1">
                            {myPlayer.boardStatus[selectedBoardView] === 'guessed' ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Finished - {options.find(o => o.id === myPlayer.guesses?.[selectedBoardView])?.text || 'Unknown'}
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Gave Up
                              </>
                            )}
                          </Badge>
                        ) : (
                          <>
                            <Button
                              onClick={() => handleMakeFinalGuess(selectedBoardView)}
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={hasFinished}
                            >
                              <Trophy className="w-3 h-3 mr-1" />
                              Final Guess
                            </Button>
                            <Button
                              onClick={() => handleGiveUpOnBoard(selectedBoardView)}
                              size="sm"
                              variant="outline"
                              disabled={hasFinished}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Give Up
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {!selectedBoardView ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Select a player board above to start tracking options</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {currentBoardOptions.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          <p>Loading board options...</p>
                        </div>
                      ) : (
                        currentBoardOptions.map((option) => {
                      const stateLabel = getOptionStateLabel(option.state);
                      const isMyGuess = myGuesses[selectedBoardView || ''] === option.id;
                      const isDiscarded = option.state === 'discarded';
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleOptionClick(option.id)}
                          disabled={option.eliminated || hasFinished || !!myPlayer?.boardStatus?.[selectedBoardView]}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all relative",
                            option.eliminated && "opacity-30 line-through bg-gray-100 dark:bg-gray-800 cursor-not-allowed",
                            !option.eliminated && !hasFinished && !myPlayer?.boardStatus?.[selectedBoardView] && "hover:border-primary cursor-pointer",
                            (hasFinished || myPlayer?.boardStatus?.[selectedBoardView]) && !option.eliminated && "cursor-not-allowed opacity-75",
                            getOptionStateColor(option.state),
                            isDiscarded && "opacity-60",
                            isMyGuess && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950"
                          )}
                        >
                          <div className="font-medium text-sm break-words">
                            {option.text}
                          </div>
                          {isMyGuess && (
                            <Badge variant="default" className="mt-1 text-xs bg-green-600">
                              My Guess
                            </Badge>
                          )}
                          {stateLabel && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {stateLabel}
                            </Badge>
                          )}
                        </button>
                      );
                    }))}
                    </div>
                  )}

                  {/* Quick Board Status - Compact */}
                  {otherPlayers.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">Boards:</span>
                      {otherPlayers.map((player) => {
                        const boardStatus = myPlayer?.boardStatus?.[player.id];
                        return (
                          <Badge 
                            key={player.id}
                            variant={boardStatus === 'guessed' ? "default" : boardStatus === 'gaveUp' ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {player.username}: {boardStatus === 'guessed' ? '✓' : boardStatus === 'gaveUp' ? '✗' : '○'}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Secret */}
            {myOption && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Secret</CardTitle>
                  <CardDescription>This is the option you're trying to figure out</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "p-4 rounded-lg border-2 text-center font-semibold",
                    myOption.eliminated ? "bg-destructive/10 border-destructive" : "bg-yellow-500/10 border-yellow-500"
                  )}>
                    {myOption.text}
                    {myOption.eliminated && (
                      <div className="text-sm font-normal text-muted-foreground mt-2">
                        (Eliminated)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
                <CardDescription>Private notes for yourself</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add your notes here..."
                  value={myNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Players</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.map((player) => {
                    const isAsking = player.id === currentTurnPlayerId;
                    const isResponding = respondingPlayer?.id === player.id;
                    
                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "p-2 rounded text-sm flex items-center justify-between",
                          isAsking ? "bg-primary text-primary-foreground" : "bg-secondary",
                          player.hasFinished && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {player.username}
                          {player.id === playerId && " (You)"}
                          {isAsking && (
                            <Badge variant="default" className="text-xs">Asking</Badge>
                          )}
                          {isResponding && !isAsking && (
                            <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900">Responding</Badge>
                          )}
                        </div>
                        {player.hasFinished && (
                          <Badge variant="outline" className="text-xs">
                            Finished
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Final Guess Modal with Multi-Step Confirmation */}
      {showGuessModal && guessTargetPlayerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    Final Guess for {players.find(p => p.id === guessTargetPlayerId)?.username}
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    {guessStep === 1 && "Step 1: Select which option you think belongs to this player"}
                    {guessStep === 2 && "Step 2: Review your selection"}
                    {guessStep === 3 && "Step 3: Confirm your final guess - this will lock this board!"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowGuessModal(false);
                    setGuessTargetPlayerId(null);
                    setGuessStep(1);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {guessStep === 1 && (
                <>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {options.filter(o => !o.eliminated).map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleSelectGuessOption(option.id)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          "hover:border-primary cursor-pointer"
                        )}
                      >
                        <div className="font-medium text-sm break-words">
                          {option.text}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              {guessStep === 2 && (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border-2 border-blue-500 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      Your Selection:
                    </p>
                    <p className="text-lg font-bold">
                      {options.find(o => o.id === myGuesses[guessTargetPlayerId])?.text || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleNextGuessStep}
                      className="flex-1"
                      size="lg"
                    >
                      Continue to Confirm
                    </Button>
                    <Button
                      onClick={() => setGuessStep(1)}
                      variant="outline"
                    >
                      Change Selection
                    </Button>
                  </div>
                </>
              )}
              
              {guessStep === 3 && (
                <>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Final Confirmation
                    </p>
                    <p className="text-base mb-2">
                      You are about to submit your final guess for <strong>{players.find(p => p.id === guessTargetPlayerId)?.username}</strong>:
                    </p>
                    <p className="text-lg font-bold mb-4">
                      {options.find(o => o.id === myGuesses[guessTargetPlayerId])?.text || 'Unknown'}
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      This will lock this board and you won't be able to change it!
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSelectGuessOption(myGuesses[guessTargetPlayerId] || '')}
                      className="flex-1"
                      size="lg"
                      variant="default"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Confirm Final Guess
                    </Button>
                    <Button
                      onClick={() => setGuessStep(2)}
                      variant="outline"
                    >
                      Go Back
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
