'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Trophy, MessageSquare, X, ArrowRight, CheckCircle, XCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    setPlayers,
    setOptions,
    setGamePhase,
    setCurrentTurnPlayerId,
    setLastQuestion,
    setMyNotes,
  } = useGameStore();

  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessOptionId, setGuessOptionId] = useState<string | null>(null);

  const isMyTurn = currentTurnPlayerId === playerId;
  const currentPlayer = players.find(p => p.id === currentTurnPlayerId);
  const myPlayer = players.find(p => p.id === playerId);
  const myOption = options.find(o => o.id === mySecretOption);
  const remainingOptions = options.filter(o => !o.eliminated);
  const hasFinished = myPlayer?.hasFinished || false;

  useEffect(() => {
    if (!socket || !playerId) {
      router.push('/');
      return;
    }

    const handleRoomUpdate = (data: any) => {
      setPlayers(data.players);
      setOptions(data.options);
      setGamePhase(data.gamePhase);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
    };

    const handlePlayerOptions = (data: any) => {
      // Update options with per-player options
      setOptions(data.options);
    };

    const handleQuestionAsked = (data: any) => {
      setLastQuestion(`${data.playerName} asked a question`);
      setSelectedOptions(new Set());
    };

    const handleTurnChanged = (data: any) => {
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setLastQuestion(null);
      setSelectedOptions(new Set());
    };

    const handleOptionsEliminated = (data: any) => {
      setSelectedOptions(new Set());
    };

    const handlePlayerGuessed = (data: any) => {
      // Player made a guess
    };

    const handlePlayerGaveUp = (data: any) => {
      // Player gave up
    };

    const handleGameFinished = () => {
      // Game finished
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('playerOptions', handlePlayerOptions);
    socket.on('questionAsked', handleQuestionAsked);
    socket.on('turnChanged', handleTurnChanged);
    socket.on('optionsEliminated', handleOptionsEliminated);
    socket.on('playerGuessed', handlePlayerGuessed);
    socket.on('playerGaveUp', handlePlayerGaveUp);
    socket.on('gameFinished', handleGameFinished);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('playerOptions', handlePlayerOptions);
      socket.off('questionAsked', handleQuestionAsked);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('optionsEliminated', handleOptionsEliminated);
      socket.off('playerGuessed', handlePlayerGuessed);
      socket.off('playerGaveUp', handlePlayerGaveUp);
      socket.off('gameFinished', handleGameFinished);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setGamePhase, setCurrentTurnPlayerId, setLastQuestion]);

  const handleAskQuestion = () => {
    socket?.emit('askQuestion', { roomId });
  };

  const toggleOption = (optionId: string) => {
    if (gamePhase !== 'elimination') return;
    if (isMyTurn) return; // Can't eliminate on your turn
    if (hasFinished) return; // Can't eliminate if finished
    
    const newSelected = new Set(selectedOptions);
    if (newSelected.has(optionId)) {
      newSelected.delete(optionId);
    } else {
      newSelected.add(optionId);
    }
    setSelectedOptions(newSelected);
  };

  const handleEliminate = () => {
    if (selectedOptions.size === 0) return;
    if (isMyTurn) return;
    socket?.emit('eliminateOptions', { 
      roomId, 
      optionIds: Array.from(selectedOptions) 
    });
  };

  const handleNextTurn = () => {
    socket?.emit('nextTurn', { roomId });
  };

  const handleMakeGuess = (optionId: string) => {
    setGuessOptionId(optionId);
    setShowGuessModal(true);
  };

  const confirmGuess = () => {
    if (guessOptionId) {
      socket?.emit('makeGuess', { roomId, optionId: guessOptionId });
      setShowGuessModal(false);
      setGuessOptionId(null);
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

  if (gamePhase === 'finished') {
    const winners = players.filter(p => {
      const guessedOptionId = p.guessedOptionId;
      if (!guessedOptionId) return false;
      const secretOptionId = options.find(o => o.id === guessedOptionId)?.id;
      // Check if their guess matches their secret (this would need server verification in real implementation)
      return true; // Simplified for now
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">Game Over!</CardTitle>
            <CardDescription>
              All players have finished
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {players.map((player) => (
                <div key={player.id} className="p-2 bg-secondary rounded text-sm">
                  <div className="font-medium">{player.username}</div>
                  {player.guessedOptionId ? (
                    <div className="text-muted-foreground">
                      Guessed: {options.find(o => o.id === player.guessedOptionId)?.text || 'Unknown'}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Gave up</div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={() => router.push('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {roomName}
          </h1>
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {gamePhase === 'question' ? 'Question Phase' : 'Elimination Phase'}
          </Badge>
        </div>

        {hasFinished && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg text-center">
            <CheckCircle className="w-5 h-5 inline mr-2 text-yellow-500" />
            <span className="font-medium">You have finished! Waiting for other players...</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Current Turn Card */}
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
                      Ask your question out loud, then click this button when done
                    </p>
                  </div>
                )}

                {gamePhase === 'question' && !isMyTurn && (
                  <div className="text-center py-4 text-muted-foreground">
                    Waiting for {currentPlayer?.username} to ask a question...
                  </div>
                )}

                {gamePhase === 'elimination' && (
                  <div className="space-y-4">
                    {lastQuestion && (
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <p className="text-lg font-medium">{lastQuestion}</p>
                      </div>
                    )}
                    
                    {!isMyTurn && !hasFinished && (
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleEliminate}
                          disabled={selectedOptions.size === 0}
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Eliminate Selected ({selectedOptions.size})
                        </Button>
                      </div>
                    )}
                    
                    {isMyTurn && (
                      <p className="text-sm text-muted-foreground text-center">
                        You cannot eliminate options on your turn. Wait for others to eliminate.
                      </p>
                    )}
                    
                    <Button 
                      onClick={handleNextTurn}
                      variant="outline"
                      className="w-full"
                    >
                      Next Turn
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Options Grid */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Your Options ({remainingOptions.length} remaining)
                </CardTitle>
                <CardDescription>
                  {isMyTurn && gamePhase === 'elimination' 
                    ? 'You cannot eliminate options on your turn'
                    : gamePhase === 'elimination'
                    ? 'Select options to eliminate based on the question'
                    : 'Click an option to make a guess'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (hasFinished) return;
                        if (gamePhase === 'elimination' && !isMyTurn) {
                          toggleOption(option.id);
                        } else if (!hasFinished) {
                          handleMakeGuess(option.id);
                        }
                      }}
                      disabled={option.eliminated || hasFinished}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        option.eliminated && "opacity-30 line-through bg-gray-100 dark:bg-gray-800",
                        !option.eliminated && gamePhase === 'elimination' && !isMyTurn && !hasFinished && "hover:border-primary cursor-pointer",
                        selectedOptions.has(option.id) && "border-destructive bg-destructive/10",
                        !option.eliminated && !selectedOptions.has(option.id) && "border-border bg-card",
                        option.id === mySecretOption && !option.eliminated && "ring-2 ring-yellow-500"
                      )}
                    >
                      <div className="font-medium text-sm break-words">
                        {option.text}
                      </div>
                      {option.id === mySecretOption && !option.eliminated && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          Your Secret
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                
                {!hasFinished && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={handleGiveUp}
                      variant="outline"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Give Up
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Secret Option</CardTitle>
              </CardHeader>
              <CardContent>
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
                        player.hasFinished && "opacity-60"
                      )}
                    >
                      <div>
                        {player.username}
                        {player.id === currentTurnPlayerId && " (Current)"}
                        {player.hasFinished && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {player.guessedOptionId ? 'Guessed' : 'Gave Up'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Guess Confirmation Modal */}
      {showGuessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Confirm Your Guess</CardTitle>
              <CardDescription>
                Are you sure you want to guess: <strong>{options.find(o => o.id === guessOptionId)?.text}</strong>?
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={confirmGuess} className="flex-1">
                Yes, I'm Sure
              </Button>
              <Button onClick={() => setShowGuessModal(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
