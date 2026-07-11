import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import {
  MessageCircle,
  Phone,
  Users,
  Settings,
  Search,
  Send,
  Paperclip,
  Image,
  Mic,
  PhoneCall,
  PhoneOff,
  MoreVertical,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  UserPlus,
  LogOut,
  X,
  Play,
  Pause,
  FileText,
  Download,
  Trash2,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Tab = "chats" | "calls" | "contacts" | "settings";
type Message = {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  senderAvatar: string | null | undefined;
  type: "text" | "image" | "file" | "voice" | "call";
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  duration: number | null;
  isEdited: boolean | null;
  replyTo: number | null;
  createdAt: Date;
};

type Chat = {
  id: number;
  type: string;
  name: string | null;
  avatar: string | null;
  lastMessage: {
    id: number;
    content: string | null;
    type: string;
    senderName: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
  members: Array<{
    id: number;
    displayName: string;
    username: string;
    avatar: string | null;
    isOnline: boolean | null;
  }>;
  updatedAt: Date;
};

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callData, setCallData] = useState<{ chatId: number; calleeId: number; calleeName: string } | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Queries
  const { data: chatList, refetch: refetchChats } = trpc.chat.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 3000,
  });

  const { data: messages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { chatId: selectedChat?.id || 0, limit: 100, offset: 0 },
    { enabled: !!selectedChat?.id, refetchInterval: 2000 }
  );

  const { data: contacts, refetch: refetchContacts } = trpc.contact.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: callList, refetch: refetchCalls } = trpc.call.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: googleDriveStatus, refetch: refetchGoogleDriveStatus } = trpc.chat.googleDriveStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const googleDriveAuthQuery = trpc.chat.getGoogleDriveAuthUrl.useQuery(undefined, {
    enabled: false,
  });

  const { data: searchResults } = trpc.contact.search.useQuery(
    { query: contactSearch },
    { enabled: contactSearch.length > 0 }
  );

  // Mutations
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      refetchChats();
    },
  });

  const backupChatToDrive = trpc.chat.backupChatToDrive.useMutation({
    onSuccess: () => {
      refetchGoogleDriveStatus();
      refetchChats();
    },
  });

  const createPrivateChat = trpc.chat.getOrCreatePrivate.useMutation({
    onSuccess: (data) => {
      setShowAddContact(false);
      refetchChats();
      const chat = chatList?.find((c) => c.id === data.chatId);
      if (chat) {
        setSelectedChat(chat);
        setShowMobileChat(true);
      }
    },
  });

  const addContact = trpc.contact.add.useMutation({
    onSuccess: () => {
      refetchContacts();
    },
  });

  const removeContact = trpc.contact.remove.useMutation({
    onSuccess: () => {
      refetchContacts();
    },
  });

  const createCall = trpc.call.create.useMutation({
    onSuccess: () => {
      refetchCalls();
    },
  });

  trpc.call.update.useMutation();

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;
    sendMessage.mutate({
      chatId: selectedChat.id,
      type: "text",
      content: messageText.trim(),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      sendMessage.mutate({
        chatId: selectedChat.id,
        type,
        fileUrl: data.url,
        fileName: data.name,
        fileSize: data.size,
      });
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      const result = await googleDriveAuthQuery.refetch();
      const url = result.data?.url;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Google Drive connect failed:", err);
    }
  };

  const handleBackupChat = () => {
    if (!selectedChat) return;
    backupChatToDrive.mutate({ chatId: selectedChat.id });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, `voice-${Date.now()}.webm`);

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (selectedChat) {
            sendMessage.mutate({
              chatId: selectedChat.id,
              type: "voice",
              fileUrl: data.url,
              fileName: data.name,
              fileSize: data.size,
              duration: recordingTime,
            });
          }
        } catch (err) {
          console.error("Voice upload failed:", err);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const initiateCall = (calleeId: number, calleeName: string) => {
    setCallData({ chatId: selectedChat?.id || 0, calleeId, calleeName });
    setIsCallActive(true);
    createCall.mutate({ calleeId });
  };

  const endCall = () => {
    setIsCallActive(false);
    setCallData(null);
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 via-blue-500 to-orange-400">
        <div className="text-white text-xl font-semibold animate-pulse">Loading iMessing...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const filteredChats = chatList?.filter((chat) =>
    (chat.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`h-screen flex overflow-hidden ${darkMode ? "dark" : ""}`}>
      {/* Sidebar */}
      <div className={`${showMobileChat ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col`}>
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-orange-400">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">iMessing</h1>
                <p className="text-white/70 text-xs">{user?.displayName || user?.username}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={logout}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-white/20 border-0 text-white placeholder:text-white/60 focus-visible:ring-white/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-4 mx-4 mt-2">
            <TabsTrigger value="chats" className="flex flex-col items-center gap-1 py-2">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">Chats</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex flex-col items-center gap-1 py-2">
              <Phone className="w-4 h-4" />
              <span className="text-xs">Calls</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex flex-col items-center gap-1 py-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col items-center gap-1 py-2">
              <Settings className="w-4 h-4" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Chats Tab */}
          <TabsContent value="chats" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {filteredChats?.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <MessageCircle className="w-12 h-12 mb-2" />
                  <p>No chats yet</p>
                  <p className="text-sm">Start a conversation from Contacts</p>
                </div>
              )}
              {filteredChats?.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    selectedChat?.id === chat.id ? "bg-cyan-50 dark:bg-cyan-900/20" : ""
                  }`}
                  onClick={() => {
                    setSelectedChat(chat);
                    setShowMobileChat(true);
                  }}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={chat.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
                        {(chat.name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {chat.members.some((m) => m.isOnline && m.id !== user?.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium truncate">{chat.name || "Unknown"}</h3>
                      {chat.lastMessage && (
                        <span className="text-xs text-gray-400">{formatTime(chat.lastMessage.createdAt)}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500 truncate">
                        {chat.lastMessage
                          ? `${chat.lastMessage.senderName}: ${chat.lastMessage.content || chat.lastMessage.type}`
                          : "No messages"}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {callList?.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Phone className="w-12 h-12 mb-2" />
                  <p>No calls yet</p>
                </div>
              )}
              {callList?.map((call) => (
                <div key={call.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={call.isOutgoing ? call.calleeAvatar || undefined : call.callerAvatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-400 to-cyan-500 text-white">
                      {call.isOutgoing
                        ? (call.calleeName || "?").charAt(0).toUpperCase()
                        : (call.callerName || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-medium">
                      {call.isOutgoing ? call.calleeName : call.callerName}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      {call.status === "missed" ? (
                        <PhoneOff className="w-3 h-3 text-red-500" />
                      ) : call.status === "answered" ? (
                        <PhoneCall className="w-3 h-3 text-green-500" />
                      ) : (
                        <Clock className="w-3 h-3 text-gray-400" />
                      )}
                      <span>
                        {call.isOutgoing ? "Outgoing" : "Incoming"} · {call.status}
                        {call.duration && call.duration > 0 ? ` · ${formatDuration(Number(call.duration))}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{call.startedAt ? formatTime(call.startedAt) : ""}</span>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="flex-1 overflow-hidden mt-0">
            <div className="p-4">
              <Button
                onClick={() => setShowAddContact(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-280px)]">
              {contacts?.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <Users className="w-12 h-12 mb-2" />
                  <p>No contacts yet</p>
                </div>
              )}
              {contacts?.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={contact.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
                        {(contact.displayName || contact.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {contact.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {contact.nickname || contact.displayName || contact.username}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{contact.status}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        createPrivateChat.mutate({ userId: contact.contactId });
                        setActiveTab("chats");
                      }}
                    >
                      <MessageCircle className="w-4 h-4 text-cyan-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        createPrivateChat.mutate(
                          { userId: contact.contactId },
                          {
                            onSuccess: (data) => {
                              const chat = chatList?.find((c) => c.id === data.chatId);
                              if (chat) {
                                setSelectedChat(chat);
                                setShowMobileChat(true);
                                initiateCall(contact.contactId, contact.displayName || contact.username);
                              }
                            },
                          }
                        );
                      }}
                    >
                      <Phone className="w-4 h-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeContact.mutate({ contactId: contact.contactId })}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-hidden mt-0 p-4">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-xl">
                    {(user?.displayName || user?.username || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{user?.displayName || user?.username}</h3>
                  <p className="text-gray-500">@{user?.username}</p>
                  <p className="text-sm text-gray-400">{user?.status}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Dark Mode
                </Label>
                <Switch id="dark-mode" checked={darkMode} onCheckedChange={setDarkMode} />
              </div>

              <Separator />

              <div className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Google Drive Backup</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Connect your account and save chat history to Google Drive.
                    </p>
                  </div>
                  <CloudUpload className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {googleDriveStatus?.connected
                      ? `Connected as ${googleDriveStatus.email}`
                      : "Not connected"}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={handleConnectGoogleDrive}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    >
                      {googleDriveStatus?.connected ? "Reconnect Google Drive" : "Connect Google Drive"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleBackupChat}
                      disabled={!googleDriveStatus?.connected || !selectedChat || backupChatToDrive.isLoading}
                    >
                      {backupChatToDrive.isLoading ? "Backing up..." : "Backup current chat"}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-orange-400 rounded-xl p-4 text-white">
                <h4 className="font-bold mb-1">iMessing Premium</h4>
                <p className="text-sm text-white/80 mb-3">Unlock all features</p>
                <Button variant="secondary" size="sm" className="w-full">
                  Coming Soon
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className={`${showMobileChat ? "flex" : "hidden md:flex"} flex-1 flex-col bg-gray-50 dark:bg-gray-900`}>
          {/* Chat Header */}
          <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setShowMobileChat(false)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedChat.avatar || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
                  {(selectedChat.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {selectedChat.members.some((m) => m.isOnline && m.id !== user?.id) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{selectedChat.name}</h3>
              <p className="text-xs text-gray-500">
                {selectedChat.members.some((m) => m.isOnline && m.id !== user?.id)
                  ? "Online"
                  : "Offline"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const otherMember = selectedChat.members.find((m) => m.id !== user?.id);
                if (otherMember) {
                  initiateCall(otherMember.id, otherMember.displayName);
                }
              }}
            >
              <Phone className="w-5 h-5 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!googleDriveStatus?.connected || backupChatToDrive.isLoading}
              onClick={handleBackupChat}
              className="text-cyan-500"
            >
              <CloudUpload className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedChat(null)}>Close Chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages?.map((msg: Message) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] ${
                      msg.senderId === user?.id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl rounded-tr-sm"
                        : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm shadow-sm"
                    } p-3`}
                  >
                    {msg.type === "text" && msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.type === "image" && msg.fileUrl && (
                      <img
                        src={msg.fileUrl}
                        alt={msg.fileName || "Image"}
                        className="max-w-full rounded-lg cursor-pointer"
                        onClick={() => window.open(msg.fileUrl || "", "_blank")}
                      />
                    )}
                    {msg.type === "file" && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-8 h-8" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{msg.fileName}</p>
                          <p className="text-xs opacity-70">{formatFileSize(msg.fileSize)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(msg.fileUrl || "", "_blank")}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {msg.type === "voice" && msg.fileUrl && (
                      <VoiceMessagePlayer
                        url={msg.fileUrl}
                        duration={msg.duration}
                        isOutgoing={msg.senderId === user?.id}
                      />
                    )}
                    {msg.type === "call" && (
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4" />
                        <span className="text-sm">Voice Call</span>
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-1 mt-1 ${
                        msg.senderId === user?.id ? "text-white/70" : "text-gray-400"
                      }`}
                    >
                      <span className="text-xs">{formatTime(msg.createdAt)}</span>
                      {msg.senderId === user?.id && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {isRecording ? (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-full px-4 py-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-medium">Recording {formatDuration(recordingTime)}</span>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="text-red-500" onClick={stopRecording}>
                  <Send className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-400" onClick={stopRecording}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "file")}
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "image")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-cyan-500"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-cyan-500"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Image className="w-5 h-5" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  className="flex-1 rounded-full"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-cyan-500"
                  onClick={startRecording}
                >
                  <Mic className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-orange-400 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <MessageCircle className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">Welcome to iMessing</h2>
            <p className="text-gray-500 dark:text-gray-400">Select a chat to start messaging</p>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by username or name..."
                className="pl-9"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-64">
              {searchResults?.length === 0 && contactSearch && (
                <p className="text-center text-gray-400 py-8">No users found</p>
              )}
              {searchResults?.map((result) => (
                <div key={result.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={result.avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-sm">
                      {(result.displayName || result.username).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.displayName || result.username}</p>
                    <p className="text-sm text-gray-500">@{result.username}</p>
                  </div>
                  {result.isContact ? (
                    <Button variant="ghost" size="sm" disabled>
                      <Check className="w-4 h-4 text-green-500" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        addContact.mutate({ contactId: result.id });
                        createPrivateChat.mutate({ userId: result.id });
                      }}
                    >
                      <UserPlus className="w-4 h-4 text-cyan-500" />
                    </Button>
                  )}
                </div>
              ))}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call Overlay */}
      {isCallActive && callData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-3xl">
                {callData.calleeName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mb-2">{callData.calleeName}</h2>
            <p className="text-white/70 mb-8">Calling...</p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
                onClick={endCall}
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Voice Message Player Component
function VoiceMessagePlayer({
  url,
  duration,
  isOutgoing,
}: {
  url: string | null;
  duration: number | null;
  isOutgoing: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      return () => {
        audio.pause();
        audio.src = "";
      };
    }
  }, [url]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const totalDuration = duration || Math.floor(currentTime) || 0;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${isOutgoing ? "text-white" : "text-cyan-500"}`}
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <div className="flex-1">
        <div className={`h-1 rounded-full ${isOutgoing ? "bg-white/30" : "bg-gray-200"}`}>
          <div
            className={`h-full rounded-full ${isOutgoing ? "bg-white" : "bg-cyan-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className={`text-xs ${isOutgoing ? "text-white/70" : "text-gray-400"}`}>
        {Math.floor(totalDuration - currentTime)}s
      </span>
    </div>
  );
}
