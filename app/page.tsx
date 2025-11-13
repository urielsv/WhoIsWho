'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/lib/socket';
import { useGameStore } from '@/lib/store';
import { Users, Plus } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const socket = useSocket();
  const setRoomInfo = useGameStore(state => state.setRoomInfo);
  
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (data: any) => {
      setIsLoading(false);
      setRoomInfo(data.roomId, roomName, data.playerId, username, data.isAdmin);
      router.push(`/lobby/${data.roomId}`);
    };

    const handleJoined = (data: any) => {
      setIsLoading(false);
      setRoomInfo(data.roomId, data.roomName, data.playerId, username, data.isAdmin);
      router.push(`/lobby/${data.roomId}`);
    };

    const handleError = (data: any) => {
      setIsLoading(false);
      setError(data.message);
    };

    socket.on('roomCreated', handleRoomCreated);
    socket.on('joined', handleJoined);
    socket.on('error', handleError);

    return () => {
      socket.off('roomCreated', handleRoomCreated);
      socket.off('joined', handleJoined);
      socket.off('error', handleError);
    };
  }, [socket, router, setRoomInfo, username, roomName]);

  const handleCreateRoom = () => {
    if (!username.trim() || !roomName.trim() || !optionsText.trim()) {
      setError('Please fill in all fields');
      return;
    }

    const options = optionsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (options.length < 2) {
      setError('Please add at least 2 options');
      return;
    }

    setError('');
    setIsLoading(true);
    socket?.emit('createRoom', { roomName, username, options });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setIsLoading(true);
    socket?.emit('joinRoom', { roomId: roomCode, username });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
            Who&apos;s Who
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            A multiplayer guessing game
          </p>
        </div>

        {mode === 'select' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setMode('create')}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Create Room</CardTitle>
                <CardDescription>
                  Start a new game and invite friends
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setMode('join')}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-gray-700" />
                </div>
                <CardTitle>Join Room</CardTitle>
                <CardDescription>
                  Enter a room code to join a game
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {mode === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle>Create a New Room</CardTitle>
              <CardDescription>
                Set up your game and add the options players will guess
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Your Name</Label>
                <Input
                  id="username"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="e.g., TV Series Game"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="options">Options (one per line)</Label>
                <Textarea
                  id="options"
                  placeholder="Game of Thrones&#10;The Office&#10;Daredevil&#10;Breaking Bad&#10;..."
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Add at least 2 options, one per line
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode('select');
                    setError('');
                  }}
                  className="w-full"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardHeader>
              <CardTitle>Join a Room</CardTitle>
              <CardDescription>
                Enter the room code shared by the host
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinUsername">Your Name</Label>
                <Input
                  id="joinUsername"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode('select');
                    setError('');
                  }}
                  className="w-full"
                >
                  Back
                </Button>
                <Button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Joining...' : 'Join Room'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

