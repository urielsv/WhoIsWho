'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Users, Crown, Check, Copy, CheckCheck, Settings, X, Plus, Trash2, UserX, ChevronDown, ChevronUp } from 'lucide-react';

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const socket = useSocket();
  const roomId = params.roomId as string;
  
  const { 
    roomId: storeRoomId,
    roomName, 
    playerId, 
    username,
    isAdmin, 
    players, 
    options,
    setRoomName,
    setPlayers,
    setOptions,
    setGameStarted,
    setGamePhase,
    setCurrentTurnPlayerId,
    setMySecretOption,
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newOptionText, setNewOptionText] = useState('');

  useEffect(() => {
    // Wait for socket to be available and connected
    if (!socket) {
      return;
    }

    // If socket is not connected yet, wait for connection
    if (!socket.connected) {
      const onConnect = () => {
        // Socket connected, continue with initialization
      };
      socket.on('connect', onConnect);
      return () => socket.off('connect', onConnect);
    }

    // Wait for playerId to be set (might take a moment after navigation)
    // Also verify that the roomId from URL matches the store
    if (!playerId || storeRoomId !== roomId) {
      // Give it a moment for the store to update after navigation
      // But if it's been more than 500ms, redirect
      const timeout = setTimeout(() => {
        if (!playerId || storeRoomId !== roomId) {
          router.push('/');
        }
      }, 500);
      return () => clearTimeout(timeout);
    }

    // Initialize form values
    if (roomName && !newRoomName) {
      setNewRoomName(roomName);
    }

    // Only set up handlers once we have both socket and playerId
    const handleRoomUpdate = (data: any) => {
      setPlayers(data.players);
      setOptions(data.options);
      setGamePhase(data.gamePhase);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      if (data.roomName) {
        setRoomName(data.roomName);
        setNewRoomName(data.roomName);
      }
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
      setTimeout(() => setError(''), 5000);
    };

    const handleKicked = (data: any) => {
      setError(data.message);
      setTimeout(() => {
        router.push('/');
      }, 2000);
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
    socket.on('kicked', handleKicked);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('gameStarted', handleGameStarted);
      socket.off('secretAssigned', handleSecretAssigned);
      socket.off('error', handleError);
      socket.off('kicked', handleKicked);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
    };
  }, [socket, playerId, roomId, storeRoomId, router, setPlayers, setOptions, setGameStarted, setGamePhase, setCurrentTurnPlayerId, setMySecretOption, setRoomName, roomName, newRoomName]);

  const handleToggleReady = () => {
    socket?.emit('toggleReady', { roomId });
  };

  const handleStartGame = () => {
    if (players.length < 2) {
      setError('Need at least 2 players to start');
      return;
    }
    if (options.length < 2) {
      setError('Need at least 2 options to start');
      return;
    }
    socket?.emit('startGame', { roomId });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateRoomName = () => {
    if (!newRoomName.trim()) {
      setError('Room name cannot be empty');
      return;
    }
    if (newRoomName.trim().length > 30) {
      setError('Room name must be 30 characters or less');
      return;
    }
    socket?.emit('updateRoomName', { roomId, roomName: newRoomName.trim() });
  };

  const handleAddOption = () => {
    if (!newOptionText.trim()) {
      setError('Option text cannot be empty');
      return;
    }
    if (newOptionText.trim().length > 30) {
      setError('Option text must be 30 characters or less');
      return;
    }
    if (options.length >= 50) {
      setError('Maximum 50 options allowed');
      return;
    }
    socket?.emit('addOption', { roomId, optionText: newOptionText.trim() });
    setNewOptionText('');
  };

  const handleRemoveOption = (optionId: string) => {
    socket?.emit('removeOption', { roomId, optionId });
  };

  const handleKickPlayer = (playerIdToKick: string) => {
    if (confirm('Are you sure you want to kick this player?')) {
      socket?.emit('kickPlayer', { roomId, playerIdToKick });
    }
  };

  const currentPlayer = players.find(p => p.id === playerId);

  // Generate color for each player
  const getPlayerColor = (playerId: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const index = players.findIndex(p => p.id === playerId);
    return colors[index % colors.length];
  };

  // Show loading state while waiting for socket connection and playerId
  // Only show loading if socket exists but isn't connected yet, or if we're waiting for store to initialize
  const isWaitingForSocket = socket && !socket.connected;
  const isWaitingForStore = !playerId || storeRoomId !== roomId;
  
  if (!socket || isWaitingForSocket || isWaitingForStore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {!socket ? 'Connecting...' : isWaitingForSocket ? 'Connecting to server...' : 'Loading lobby...'}
          </div>
          {isWaitingForStore && socket?.connected && (
            <p className="text-sm text-muted-foreground mt-2">
              If this takes too long, you may need to join the room again.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-5xl mx-auto py-8">
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

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({players.length}/4)
              </CardTitle>
              <CardDescription>
                {players.length < 2 ? 'Waiting for more players...' : players.length >= 4 ? 'Room is full!' : 'Ready to start!'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.id === playerId 
                        ? 'bg-primary/10 border-2 border-primary' 
                        : 'bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${getPlayerColor(player.id)} flex items-center justify-center text-white font-bold`}>
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{player.username}</span>
                          {player.id === playerId && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                          {player.isAdmin && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        {player.isReady && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3" />
                            Ready
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && !player.isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleKickPlayer(player.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
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
                  {currentPlayer?.isReady ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Not Ready
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Ready
                    </>
                  )}
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
              <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
                {options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
                  >
                    <span>{option.text}</span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(option.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        disabled={options.length <= 1}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add new option..."
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddOption();
                        }
                      }}
                      maxLength={30}
                      className="flex-1"
                      disabled={options.length >= 50}
                    />
                    <Button
                      onClick={handleAddOption}
                      size="sm"
                      variant="outline"
                      disabled={options.length >= 50}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {newOptionText.length}/30 characters • {options.length}/50 options
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto"
                onClick={() => setShowSettings(!showSettings)}
              >
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Admin Settings
                </CardTitle>
                {showSettings ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            </CardHeader>
            {showSettings && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Room Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="roomName"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateRoomName();
                        }
                      }}
                      maxLength={30}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUpdateRoomName}
                      variant="outline"
                    >
                      Update
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {newRoomName.length}/30 characters
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Room Code: <code className="px-2 py-1 bg-secondary rounded">{roomId}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Players can join using this code. You can kick players by clicking the user icon next to their name.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {isAdmin && (
          <div className="flex justify-center">
            <Button
              onClick={handleStartGame}
              size="lg"
              className="px-8"
              disabled={players.length < 2 || options.length < 2}
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
