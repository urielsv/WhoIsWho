'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Users, Crown, Check, Copy, CheckCheck } from 'lucide-react';

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const socket = useSocket();
  const roomId = params.roomId as string;
  
  const { 
    roomName, 
    playerId, 
    username,
    isAdmin, 
    players, 
    options,
    setPlayers,
    setOptions,
    setGameStarted,
    setGamePhase,
    setCurrentTurnPlayerId,
    setMySecretOption,
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

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

    const handleGameStarted = () => {
      setGameStarted(true);
      router.push(`/game/${roomId}`);
    };

    const handleSecretAssigned = (data: any) => {
      setMySecretOption(data.optionId);
    };

    const handleError = (data: any) => {
      setError(data.message);
    };

    const handlePlayerJoined = (data: any) => {
      // Room update will handle the player list
    };

    const handlePlayerLeft = (data: any) => {
      // Room update will handle the player list
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('gameStarted', handleGameStarted);
    socket.on('secretAssigned', handleSecretAssigned);
    socket.on('error', handleError);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('gameStarted', handleGameStarted);
      socket.off('secretAssigned', handleSecretAssigned);
      socket.off('error', handleError);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
    };
  }, [socket, playerId, roomId, router, setPlayers, setOptions, setGameStarted, setGamePhase, setCurrentTurnPlayerId, setMySecretOption]);

  const handleToggleReady = () => {
    socket?.emit('toggleReady', { roomId });
  };

  const handleStartGame = () => {
    if (players.length < 2) {
      setError('Need at least 2 players to start');
      return;
    }
    socket?.emit('startGame', { roomId });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPlayer = players.find(p => p.id === playerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {roomName}
          </h1>
          <div className="flex items-center justify-center gap-2">
            <code className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg text-lg font-mono">
              {roomId}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyRoomCode}
            >
              {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Share this code with your friends!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({players.length})
              </CardTitle>
              <CardDescription>
                Waiting for players to join...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.username}</span>
                      {player.isAdmin && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    {player.isReady && (
                      <Badge variant="default">
                        <Check className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {!isAdmin && (
                <Button
                  onClick={handleToggleReady}
                  variant={currentPlayer?.isReady ? "outline" : "default"}
                  className="w-full mt-4"
                >
                  {currentPlayer?.isReady ? 'Not Ready' : 'Ready'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Game Options ({options.length})</CardTitle>
              <CardDescription>
                Each player will be secretly assigned one option
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {options.map((option) => (
                  <div
                    key={option.id}
                    className="p-2 bg-secondary rounded text-sm"
                  >
                    {option.text}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-center">
            {error}
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleStartGame}
              size="lg"
              className="px-8"
              disabled={players.length < 2}
            >
              Start Game
            </Button>
          </div>
        )}

        {!isAdmin && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Waiting for the host to start the game...
          </div>
        )}
      </div>
    </div>
  );
}

