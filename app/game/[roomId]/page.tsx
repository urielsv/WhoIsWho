'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Trophy, MessageSquare, X, ArrowRight } from 'lucide-react';
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
    setPlayers,
    setOptions,
    setGamePhase,
    setCurrentTurnPlayerId,
    setLastQuestion,
  } = useGameStore();

  const [question, setQuestion] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [tempQuestion, setTempQuestion] = useState('');

  const isMyTurn = currentTurnPlayerId === playerId;
  const currentPlayer = players.find(p => p.id === currentTurnPlayerId);
  const myOption = options.find(o => o.id === mySecretOption);
  const remainingOptions = options.filter(o => !o.eliminated);

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

    const handleQuestionAsked = (data: any) => {
      setLastQuestion(data.question);
      setQuestion('');
    };

    const handleTurnChanged = (data: any) => {
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setLastQuestion(null);
      setSelectedOptions(new Set());
    };

    const handleOptionsEliminated = (data: any) => {
      setSelectedOptions(new Set());
    };

    const handleGameFinished = () => {
      // Game finished
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('questionAsked', handleQuestionAsked);
    socket.on('turnChanged', handleTurnChanged);
    socket.on('optionsEliminated', handleOptionsEliminated);
    socket.on('gameFinished', handleGameFinished);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('questionAsked', handleQuestionAsked);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('optionsEliminated', handleOptionsEliminated);
      socket.off('gameFinished', handleGameFinished);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setGamePhase, setCurrentTurnPlayerId, setLastQuestion]);

  const handleAskQuestion = () => {
    if (!question.trim()) return;
    socket?.emit('askQuestion', { roomId, question: question.trim() });
    setTempQuestion(question.trim());
  };

  const toggleOption = (optionId: string) => {
    if (gamePhase !== 'elimination') return;
    
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
    socket?.emit('eliminateOptions', { 
      roomId, 
      optionIds: Array.from(selectedOptions) 
    });
  };

  const handleNextTurn = () => {
    socket?.emit('nextTurn', { roomId });
  };

  if (gamePhase === 'finished') {
    const winner = remainingOptions[0];
    const winningPlayer = players.find(p => 
      options.find(o => o.id === mySecretOption)?.id === winner?.id
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">Game Over!</CardTitle>
            <CardDescription>
              {remainingOptions.length > 0 && (
                <>The answer was: <strong>{winner?.text}</strong></>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {gamePhase === 'question' && isMyTurn && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask a yes/no question..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      />
                      <Button onClick={handleAskQuestion} disabled={!question.trim()}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Ask
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ask a yes/no question to help narrow down the options
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
                        <p className="font-medium text-sm text-muted-foreground mb-1">
                          Question from {currentPlayer?.username}:
                        </p>
                        <p className="text-lg">{lastQuestion}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleEliminate}
                        disabled={selectedOptions.size === 0}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Eliminate Selected ({selectedOptions.size})
                      </Button>
                      <Button 
                        onClick={handleNextTurn}
                        variant="outline"
                      >
                        Next Turn
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Select options to eliminate based on the question
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Options Grid */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Options ({remainingOptions.length} remaining)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleOption(option.id)}
                      disabled={option.eliminated || gamePhase !== 'elimination'}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        option.eliminated && "opacity-30 line-through bg-gray-100 dark:bg-gray-800",
                        !option.eliminated && gamePhase === 'elimination' && "hover:border-primary cursor-pointer",
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
                <CardTitle>Players</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={cn(
                        "p-2 rounded text-sm",
                        player.id === currentTurnPlayerId ? "bg-primary text-primary-foreground" : "bg-secondary"
                      )}
                    >
                      {player.username}
                      {player.id === currentTurnPlayerId && " (Current)"}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How to Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>1. Each player has a secret option assigned</p>
                <p>2. Take turns asking yes/no questions</p>
                <p>3. Eliminate options based on answers</p>
                <p>4. Last option standing wins!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

