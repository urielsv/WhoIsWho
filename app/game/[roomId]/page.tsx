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
    gamePhase,
    currentTurnPlayerId,
    mySecretOption,
    lastQuestion,
    myNotes,
    myGuesses,
    setPlayers,
    setOptions,
    setGamePhase,
    setCurrentTurnPlayerId,
    setLastQuestion,
    setMyNotes,
    addGuess,
  } = useGameStore();

  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessTargetPlayerId, setGuessTargetPlayerId] = useState<string | null>(null); // Which player we're guessing for
  const [showMyGuessModal, setShowMyGuessModal] = useState(false); // Modal for guessing own secret
  const [showHelp, setShowHelp] = useState(false);
  const [selectedPlayerView, setSelectedPlayerView] = useState<string | null>(null); // Which player's board to view
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelectedOptions, setBulkSelectedOptions] = useState<Set<string>>(new Set());
  const [gameResults, setGameResults] = useState<any[]>([]);
  const [gameStats, setGameStats] = useState<any>(null);

  const isMyTurn = currentTurnPlayerId === playerId;
  const currentPlayer = players.find(p => p.id === currentTurnPlayerId);
  const myPlayer = players.find(p => p.id === playerId);
  const myOption = options.find(o => o.id === mySecretOption);
  const remainingOptions = options.filter(o => !o.eliminated);
  const hasFinished = myPlayer?.hasFinished || false;
  
  // Active players for asks/responds - display current turn player and the next in rotation
  const activePlayers = players.filter(p => !p.hasFinished);
  // Get the two players who are currently in the asks/responds rotation
  // This will be the current turn player and whoever asks/responds with them
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);
  const currentPlayerIndex = activePlayers.findIndex(p => p.id === currentTurnPlayerId);
  
  let asksRespondsPlayers: typeof players = [];
  if (activePlayers.length >= 2 && currentPlayerIndex !== -1) {
    // Find who the current player is paired with
    // We'll show the current player and one other active player
    const nextIndex = (currentPlayerIndex + 1) % activePlayers.length;
    asksRespondsPlayers = [activePlayers[currentPlayerIndex], activePlayers[nextIndex]];
  } else {
    asksRespondsPlayers = activePlayers.slice(0, 2);
  }

  useEffect(() => {
    if (!socket || !playerId) {
      router.push('/');
      return;
    }

    // Set default view to current player
    if (!selectedPlayerView && playerId) {
      setSelectedPlayerView(playerId);
    }

    const handleRoomUpdate = (data: any) => {
      setPlayers(data.players);
      setOptions(data.options);
      setGamePhase(data.gamePhase);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
    };

    const handlePlayerOptions = (data: any) => {
      setOptions(data.options);
    };

    const handlePlayerBoardView = (data: any) => {
      // Update options when viewing a different player's board
      if (data.targetPlayerId === selectedPlayerView) {
        setOptions(data.options);
      }
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

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('playerOptions', handlePlayerOptions);
    socket.on('playerBoardView', handlePlayerBoardView);
    socket.on('questionAsked', handleQuestionAsked);
    socket.on('turnChanged', handleTurnChanged);
    socket.on('playerGuessed', handlePlayerGuessed);
    socket.on('playerGaveUp', handlePlayerGaveUp);
    socket.on('gameFinished', handleGameFinished);
    socket.on('pairRotated', handlePairRotated);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('playerOptions', handlePlayerOptions);
      socket.off('playerBoardView', handlePlayerBoardView);
      socket.off('questionAsked', handleQuestionAsked);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('playerGuessed', handlePlayerGuessed);
      socket.off('playerGaveUp', handlePlayerGaveUp);
      socket.off('gameFinished', handleGameFinished);
      socket.off('pairRotated', handlePairRotated);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setGamePhase, setCurrentTurnPlayerId, setLastQuestion, selectedPlayerView]);

  // Request board view when selected player changes
  useEffect(() => {
    if (socket && selectedPlayerView) {
      socket.emit('getPlayerBoard', { roomId, targetPlayerId: selectedPlayerView });
    }
  }, [socket, roomId, selectedPlayerView]);

  const handleAskQuestion = () => {
    socket?.emit('askQuestion', { roomId });
  };

  const handleOptionClick = (optionId: string) => {
    if (hasFinished) return;
    
    const option = options.find(o => o.id === optionId);
    if (!option || option.eliminated) return;

    // Bulk select mode
    if (bulkSelectMode) {
      const newSelected = new Set(bulkSelectedOptions);
      if (newSelected.has(optionId)) {
        newSelected.delete(optionId);
      } else {
        newSelected.add(optionId);
      }
      setBulkSelectedOptions(newSelected);
      return;
    }

    // Simple toggle: click to discard/undiscard for the currently viewed player
    // This automatically discards for the player whose board we're viewing
    const targetPlayerId = selectedPlayerView || playerId;
    
    socket?.emit('cycleOptionState', { 
      roomId, 
      optionId,
      targetPlayerId
    });
  };

  const handleBulkDiscard = (targetPlayerId: string) => {
    if (bulkSelectedOptions.size === 0) return;
    socket?.emit('bulkDiscard', {
      roomId,
      optionIds: Array.from(bulkSelectedOptions),
      targetPlayerId
    });
    setBulkSelectedOptions(new Set());
    setBulkSelectMode(false);
  };

  const handleMakeGuessForPlayer = (targetPlayerId: string) => {
    // Don't allow guessing for yourself
    if (targetPlayerId === playerId) {
      alert("You can't guess your own option!");
      return;
    }
    setGuessTargetPlayerId(targetPlayerId);
    setShowGuessModal(true);
  };

  const handleSelectGuessOption = (optionId: string) => {
    if (!guessTargetPlayerId) return;
    
    // Save guess locally
    addGuess(guessTargetPlayerId, optionId);
    
    // Send to server
    socket?.emit('makeGuessForPlayer', { 
      roomId, 
      targetPlayerId: guessTargetPlayerId,
      optionId
    });
    
    setShowGuessModal(false);
    setGuessTargetPlayerId(null);
  };

  const handleGuessMyOwnSecret = (optionId: string) => {
    // This is the final guess for your own secret - marks you as finished
    if (confirm('Are you sure this is your secret? This will mark you as finished.')) {
      socket?.emit('makeGuess', { 
        roomId, 
        optionId,
        confirmation: 'CONFIRMED'
      });
      setShowMyGuessModal(false);
    }
  };

  const handleGiveUp = () => {
    if (confirm('Are you sure you want to give up? You will be marked as finished.')) {
      socket?.emit('giveUp', { roomId });
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

  const getOptionStateLabel = (state: OptionState | undefined, discardedForPlayerId?: string) => {
    if (state === 'discarded') {
      const player = players.find(p => p.id === discardedForPlayerId);
      return player ? `Discarded for ${player.username}` : 'Discarded';
    }
    return '';
  };

  if (gamePhase === 'finished') {
    const winners = gameResults.filter((r: any) => r.isCorrect);
    const hasWinners = winners.length > 0;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-6">
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
                  ? `${winners.length} ${winners.length === 1 ? 'Player' : 'Players'} Guessed Correctly!`
                  : 'Everyone gave their best shot!'}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Stats Card */}
          {gameStats && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{gameStats.totalPlayers}</div>
                    <div className="text-sm text-muted-foreground">Total Players</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{gameStats.correctGuesses}</div>
                    <div className="text-sm text-muted-foreground">Correct Guesses</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{gameStats.gaveUp}</div>
                    <div className="text-sm text-muted-foreground">Gave Up</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {gameResults.map((result: any, index: number) => {
              const isWinner = result.isCorrect;
              const isMe = result.playerId === playerId;
              
              return (
                <Card 
                  key={result.playerId} 
                  className={cn(
                    "transition-all duration-300 hover:scale-105",
                    isWinner && "border-4 border-green-500 dark:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-xl",
                    !isWinner && !result.gaveUp && "border-2 border-red-300 dark:border-red-700 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950",
                    result.gaveUp && "border-2 border-gray-300 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950 dark:to-slate-950"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                          isWinner && "bg-gradient-to-br from-green-500 to-emerald-600",
                          !isWinner && !result.gaveUp && "bg-gradient-to-br from-red-500 to-pink-600",
                          result.gaveUp && "bg-gradient-to-br from-gray-500 to-slate-600"
                        )}>
                          {isWinner ? <Award className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <CardTitle className="text-xl">
                            {result.playerName}
                            {isMe && <span className="ml-2 text-sm text-muted-foreground">(You)</span>}
                          </CardTitle>
                          {isWinner && (
                            <Badge className="mt-1 bg-green-500 text-white">
                              <Star className="w-3 h-3 mr-1" />
                              Winner!
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Actual Secret - Revealed! */}
                    <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary/30">
                      <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
                        Actual Secret
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {result.actualSecretText}
                      </div>
                    </div>

                    {/* Their Guess */}
                    {result.gaveUp ? (
                      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                        <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                          Result
                        </div>
                        <div className="text-base text-muted-foreground flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          Gave Up
                        </div>
                      </div>
                    ) : (
                      <div className={cn(
                        "p-3 rounded-lg border-2",
                        isWinner 
                          ? "bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600" 
                          : "bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600"
                      )}>
                        <div className="text-xs font-semibold mb-1 uppercase tracking-wide flex items-center gap-2">
                          {isWinner ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-green-700 dark:text-green-300">Correct Guess!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="text-red-700 dark:text-red-300">Incorrect Guess</span>
                            </>
                          )}
                        </div>
                        <div className={cn(
                          "text-base font-medium",
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
          <div className="flex items-center justify-center gap-4">
            <Badge variant="secondary" className="text-lg px-4 py-1">
              {gamePhase === 'question' ? 'Question Phase' : 'Elimination Phase'}
            </Badge>
            {asksRespondsPlayers.length >= 2 && (
              <Badge variant="outline" className="text-sm">
                Asks ↔ Responds: {asksRespondsPlayers.map(p => p.username).join(' ↔ ')}
              </Badge>
            )}
          </div>
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
                <strong className="text-blue-900 dark:text-blue-100">Quick Discard:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li><strong>Click option:</strong> Toggle discard for the player whose board you're viewing</li>
                  <li><strong>Click again:</strong> Undo discard (back to normal)</li>
                  <li><strong>Switch boards:</strong> Use the player buttons to view different player boards</li>
                </ul>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Bulk Operations:</strong>
                <p className="text-muted-foreground mt-1">
                  Enable bulk mode to select multiple options, then discard them all at once for faster gameplay.
                </p>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Player Boards:</strong>
                <p className="text-muted-foreground mt-1">
                  Click player buttons to switch between boards. When viewing a player's board, clicking options will discard them for THAT player.
                </p>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Making Guesses:</strong>
                <p className="text-muted-foreground mt-1">
                  Use the "Make Guess" buttons to guess which option belongs to each player. You can make one guess per player.
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
                  <span>Current Turn: {currentPlayer?.username}</span>
                  {isMyTurn && <Badge>Your Turn</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
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

                {gamePhase === 'question' && !isMyTurn && (
                  <div className="text-center py-4 text-muted-foreground">
                    Waiting for {currentPlayer?.username} to ask a question...
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Player Boards</CardTitle>
                    <CardDescription>
                      View and manage options for different players
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={bulkSelectMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBulkSelectMode(!bulkSelectMode);
                        if (bulkSelectMode) {
                          setBulkSelectedOptions(new Set());
                        }
                      }}
                    >
                      {bulkSelectMode ? 'Cancel Bulk' : 'Bulk Select'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Player Selector Carousel */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  {players.map((player) => (
                    <Button
                      key={player.id}
                      variant={selectedPlayerView === player.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPlayerView(player.id)}
                      className={cn(
                        "whitespace-nowrap",
                        player.id === playerId && "ring-2 ring-yellow-500"
                      )}
                    >
                      <User className="w-4 h-4 mr-1" />
                      {player.username}
                      {player.id === playerId && ' (You)'}
                      {player.hasFinished && (
                        <CheckCircle className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                  ))}
                </div>

                {/* Options Grid for Selected Player */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-2 bg-secondary rounded">
                    <div className="text-sm">
                      Viewing board for: <strong>{players.find(p => p.id === selectedPlayerView)?.username}</strong>
                      {selectedPlayerView === playerId && ' (Your Board)'}
                    </div>
                    {selectedPlayerView && selectedPlayerView !== playerId && !hasFinished && (
                      <Button
                        onClick={() => handleMakeGuessForPlayer(selectedPlayerView)}
                        size="sm"
                        variant={myGuesses[selectedPlayerView] ? "outline" : "default"}
                        className={myGuesses[selectedPlayerView] ? "border-green-500 text-green-700 dark:text-green-400" : ""}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {myGuesses[selectedPlayerView] ? 'Change Guess' : `Make Guess for ${players.find(p => p.id === selectedPlayerView)?.username}`}
                      </Button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {options.map((option) => {
                      const stateLabel = getOptionStateLabel(option.state, option.discardedForPlayerId);
                      const isBulkSelected = bulkSelectedOptions.has(option.id);
                      const isViewingMyBoard = selectedPlayerView === playerId;
                      const isDiscardedForThisPlayer = option.discardedForPlayerId === selectedPlayerView;
                      const isGuessedForViewedPlayer = myGuesses[selectedPlayerView || ''] === option.id;
                      
                      // Show all options when viewing own board, or show options relevant to selected player
                      const shouldShow = isViewingMyBoard || isDiscardedForThisPlayer || !option.state || option.state === 'normal';
                      
                      if (!shouldShow) return null;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleOptionClick(option.id)}
                          disabled={option.eliminated || hasFinished}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all relative",
                            option.eliminated && "opacity-30 line-through bg-gray-100 dark:bg-gray-800 cursor-not-allowed",
                            !option.eliminated && !hasFinished && "hover:border-primary cursor-pointer",
                            getOptionStateColor(option.state),
                            option.id === mySecretOption && !option.eliminated && isViewingMyBoard && "ring-2 ring-yellow-500",
                            isBulkSelected && "ring-4 ring-blue-500 border-blue-500",
                            isDiscardedForThisPlayer && !isViewingMyBoard && "border-blue-300 dark:border-blue-700",
                            isGuessedForViewedPlayer && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950"
                          )}
                        >
                          <div className="font-medium text-sm break-words">
                            {option.text}
                          </div>
                          {option.id === mySecretOption && !option.eliminated && isViewingMyBoard && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              Your Secret
                            </Badge>
                          )}
                          {isGuessedForViewedPlayer && (
                            <Badge variant="default" className="mt-1 text-xs bg-green-600">
                              Your Guess
                            </Badge>
                          )}
                          {stateLabel && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {stateLabel}
                            </Badge>
                          )}
                          {isBulkSelected && (
                            <div className="absolute top-1 right-1">
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bulk Actions */}
                  {bulkSelectMode && bulkSelectedOptions.size > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{bulkSelectedOptions.size} options selected</p>
                            <p className="text-sm text-muted-foreground">Choose a player to discard for:</p>
                          </div>
                          <div className="flex gap-2">
                            {players.map((player) => (
                              <Button
                                key={player.id}
                                onClick={() => handleBulkDiscard(player.id)}
                                size="sm"
                                variant="outline"
                              >
                                <User className="w-3 h-3 mr-1" />
                                {player.username}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Quick Actions */}
                  {!hasFinished && !bulkSelectMode && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={handleGiveUp}
                        variant="outline"
                        size="sm"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Give Up
                      </Button>
                      <p className="text-xs text-muted-foreground self-center">
                        💡 Tip: Switch player boards to make guesses for each player
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Secret Option</CardTitle>
                <CardDescription>
                  {hasFinished 
                    ? "You've finished! Waiting for others..." 
                    : "Think you know your secret? Make your final guess below!"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myOption && (
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
                )}
                {!hasFinished && (
                  <Button
                    onClick={() => setShowMyGuessModal(true)}
                    className="w-full"
                    size="lg"
                    variant="default"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Guess My Secret
                  </Button>
                )}
                {myPlayer?.guessedOptionId && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-500 rounded-lg">
                    <div className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
                      Your Guess:
                    </div>
                    <div className="text-base font-bold text-green-800 dark:text-green-200">
                      {options.find(o => o.id === myPlayer.guessedOptionId)?.text || 'Unknown'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

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
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={cn(
                        "p-2 rounded text-sm flex items-center justify-between",
                        player.id === currentTurnPlayerId ? "bg-primary text-primary-foreground" : "bg-secondary",
                        player.hasFinished && "opacity-60",
                        asksRespondsPlayers.some(p => p.id === player.id) && "ring-2 ring-blue-500"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {player.username}
                        {player.id === currentTurnPlayerId && " (Current)"}
                        {asksRespondsPlayers.some(p => p.id === player.id) && (
                          <Badge variant="outline" className="text-xs">Asking</Badge>
                        )}
                      </div>
                      {player.hasFinished && (
                        <Badge variant="outline" className="text-xs">
                          {player.guessedOptionId ? 'Guessed' : 'Gave Up'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Guess Selection Modal for Other Players */}
      {showGuessModal && guessTargetPlayerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    Make Guess for {players.find(p => p.id === guessTargetPlayerId)?.username}
                  </CardTitle>
                  <CardDescription>
                    Select which option you think belongs to this player
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowGuessModal(false);
                    setGuessTargetPlayerId(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {options.filter(o => !o.eliminated).map((option) => {
                  const isCurrentGuess = myGuesses[guessTargetPlayerId] === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectGuessOption(option.id)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        "hover:border-primary cursor-pointer",
                        isCurrentGuess && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950 border-green-500"
                      )}
                    >
                      <div className="font-medium text-sm break-words">
                        {option.text}
                      </div>
                      {isCurrentGuess && (
                        <Badge variant="default" className="mt-1 text-xs bg-green-600">
                          Current Guess
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guess My Own Secret Modal */}
      {showMyGuessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    Guess Your Secret
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    Select which option you think is YOUR secret. This will mark you as finished!
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMyGuessModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500 rounded-lg">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ Important: This is your FINAL guess for your own secret. Once you submit, you'll be marked as finished!
                </p>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {options.filter(o => !o.eliminated).map((option) => {
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleGuessMyOwnSecret(option.id)}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        "hover:border-primary cursor-pointer hover:scale-105"
                      )}
                    >
                      <div className="font-medium text-sm break-words">
                        {option.text}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
