import { ChatForm } from "@/components/chat-form";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <main className="w-full max-w-2xl">
        <ChatForm />
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          Professor de Inglês com IA — Chrome com Gemini Nano
        </footer>
      </main>
    </div>
  );
}
