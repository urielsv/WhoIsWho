'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Trophy, MessageSquare, ArrowRight, CheckCircle, XCircle, FileText, HelpCircle, User } from 'lucide-react';
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
    setPlayers,
    setOptions,
    setGamePhase,
    setCurrentTurnPlayerId,
    setLastQuestion,
    setMyNotes,
  } = useGameStore();

  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessOptionId, setGuessOptionId] = useState<string | null>(null);
  const [guessStep, setGuessStep] = useState(1); // Multi-step confirmation
  const [showPlayerSelect, setShowPlayerSelect] = useState<string | null>(null); // optionId for player selection
  const [showHelp, setShowHelp] = useState(false);

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
      setOptions(data.options);
    };

    const handleQuestionAsked = (data: any) => {
      setLastQuestion(`${data.playerName} asked a question`);
    };

    const handleTurnChanged = (data: any) => {
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setLastQuestion(null);
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
    socket.on('playerGuessed', handlePlayerGuessed);
    socket.on('playerGaveUp', handlePlayerGaveUp);
    socket.on('gameFinished', handleGameFinished);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('playerOptions', handlePlayerOptions);
      socket.off('questionAsked', handleQuestionAsked);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('playerGuessed', handlePlayerGuessed);
      socket.off('playerGaveUp', handlePlayerGaveUp);
      socket.off('gameFinished', handleGameFinished);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setGamePhase, setCurrentTurnPlayerId, setLastQuestion]);

  const handleAskQuestion = () => {
    socket?.emit('askQuestion', { roomId });
  };

  const handleOptionClick = (optionId: string) => {
    if (hasFinished) return;
    
    const option = options.find(o => o.id === optionId);
    if (!option || option.eliminated) return;

    // If option is in 'possibleGuess' state, show guess modal
    if (option.state === 'possibleGuess') {
      setGuessOptionId(optionId);
      setShowGuessModal(true);
      setGuessStep(1);
      return;
    }

    // If option is 'normal', show player selection for discarding
    if (!option.state || option.state === 'normal') {
      setShowPlayerSelect(optionId);
      return;
    }

    // Otherwise, cycle the state (discarded -> possibleGuess -> normal)
    socket?.emit('cycleOptionState', { 
      roomId, 
      optionId,
      targetPlayerId: option.discardedForPlayerId || playerId
    });
  };

  const handleDiscardForPlayer = (optionId: string, targetPlayerId: string) => {
    socket?.emit('cycleOptionState', { 
      roomId, 
      optionId,
      targetPlayerId
    });
    setShowPlayerSelect(null);
  };

  const handleNextGuessStep = () => {
    if (guessStep === 1) {
      setGuessStep(2);
    } else if (guessStep === 2) {
      setGuessStep(3);
    }
  };

  const confirmGuess = () => {
    if (guessOptionId && guessStep === 3) {
      socket?.emit('makeGuess', { 
        roomId, 
        optionId: guessOptionId,
        confirmation: 'CONFIRMED'
      });
      setShowGuessModal(false);
      setGuessOptionId(null);
      setGuessStep(1);
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
      case 'possibleGuess':
        return 'bg-green-200 dark:bg-green-900 border-green-500 ring-2 ring-green-500';
      default:
        return 'bg-card border-border';
    }
  };

  const getOptionStateLabel = (state: OptionState | undefined, discardedForPlayerId?: string) => {
    switch (state) {
      case 'discarded':
        const player = players.find(p => p.id === discardedForPlayerId);
        return player ? `Discarded for ${player.username}` : 'Discarded';
      case 'possibleGuess':
        return 'Possible Guess';
      default:
        return '';
    }
  };

  if (gamePhase === 'finished') {
    const winners = players.filter(p => p.guessedOptionId);

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
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {gamePhase === 'question' ? 'Question Phase' : 'Elimination Phase'}
          </Badge>
        </div>

        {showHelp && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                How to Play
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Click Options to Cycle States:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li><strong>1st Click:</strong> Mark as discarded (gray) - choose which player</li>
                  <li><strong>2nd Click:</strong> Mark as possible guess (green highlight)</li>
                  <li><strong>3rd Click:</strong> Back to normal</li>
                </ul>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Making a Guess:</strong>
                <p className="text-muted-foreground mt-1">
                  Click an option marked as "Possible Guess" to start the guess process. You'll need to confirm 3 times to finalize your guess.
                </p>
              </div>
              <div>
                <strong className="text-blue-900 dark:text-blue-100">Discarding Options:</strong>
                <p className="text-muted-foreground mt-1">
                  When you click a normal option, you'll choose which player it's discarded for. This helps you track who might have which option.
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
                  Click options to cycle: Normal → Discarded (gray) → Possible Guess (green) → Normal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {options.map((option) => {
                    const stateLabel = getOptionStateLabel(option.state, option.discardedForPlayerId);
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
                        {stateLabel && (
                          <Badge 
                            variant={option.state === 'possibleGuess' ? 'default' : 'outline'} 
                            className="mt-1 text-xs"
                          >
                            {stateLabel}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {!hasFinished && (
                  <div className="mt-4">
                    <Button
                      onClick={handleGiveUp}
                      variant="outline"
                      className="w-full"
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
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {player.username}
                        {player.id === currentTurnPlayerId && " (Current)"}
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

      {/* Player Selection Modal */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Discard for Which Player?</CardTitle>
              <CardDescription>
                Select which player this option should be marked as discarded for
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {players.map((player) => (
                <Button
                  key={player.id}
                  onClick={() => handleDiscardForPlayer(showPlayerSelect, player.id)}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <User className="w-4 h-4 mr-2" />
                  {player.username}
                  {player.id === playerId && ' (You)'}
                </Button>
              ))}
              <Button
                onClick={() => setShowPlayerSelect(null)}
                variant="ghost"
                className="w-full mt-2"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Multi-Step Guess Confirmation Modal */}
      {showGuessModal && guessOptionId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>
                Confirm Your Guess {guessStep > 1 && `(Step ${guessStep}/3)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {guessStep === 1 && (
                <>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                    <p className="font-medium mb-2">You are about to guess:</p>
                    <p className="text-lg">{options.find(o => o.id === guessOptionId)?.text}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is your first confirmation. You'll need to confirm 2 more times to finalize your guess.
                  </p>
                  <Button onClick={handleNextGuessStep} className="w-full">
                    Continue to Step 2
                  </Button>
                </>
              )}
              
              {guessStep === 2 && (
                <>
                  <div className="p-4 bg-orange-500/10 border border-orange-500 rounded-lg">
                    <p className="font-medium mb-2">Second Confirmation:</p>
                    <p className="text-lg">{options.find(o => o.id === guessOptionId)?.text}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Are you sure this is your final guess? One more confirmation required.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleNextGuessStep} className="flex-1">
                      Continue to Final Step
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowGuessModal(false);
                        setGuessStep(1);
                      }} 
                      variant="outline" 
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
              
              {guessStep === 3 && (
                <>
                  <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                    <p className="font-medium mb-2">FINAL CONFIRMATION:</p>
                    <p className="text-lg font-bold">{options.find(o => o.id === guessOptionId)?.text}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is your final chance to change your mind. Once confirmed, you cannot undo this guess.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={confirmGuess} variant="destructive" className="flex-1">
                      Yes, Finalize My Guess
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowGuessModal(false);
                        setGuessStep(1);
                      }} 
                      variant="outline" 
                      className="flex-1"
                    >
                      Cancel
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
