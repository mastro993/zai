import { useState } from "react";
import { useTransactionList } from "./api/transactions";
import "./App.css";
import reactLogo from "./assets/react.svg";

function App() {
  const [name, setName] = useState("");

  const { data, isLoading, isError, fetchNextPage, hasNextPage, error } =
    useTransactionList();

  console.log(data, isLoading, isError, error);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-white">
            Welcome to{" "}
            <span className="text-blue-600 dark:text-blue-400">Tauri</span> +{" "}
            <span className="text-green-600 dark:text-green-400">React</span>
          </h1>

          <div className="flex flex-wrap justify-center gap-8 mb-12">
            <a
              href="https://vitejs.dev"
              target="_blank"
              className="transform hover:scale-110 transition-transform duration-200"
            >
              <img src="/vite.svg" className="h-24 w-24" alt="Vite logo" />
            </a>
            <a
              href="https://tauri.app"
              target="_blank"
              className="transform hover:scale-110 transition-transform duration-200"
            >
              <img src="/tauri.svg" className="h-24 w-24" alt="Tauri logo" />
            </a>
            <a
              href="https://reactjs.org"
              target="_blank"
              className="transform hover:scale-110 transition-transform duration-200"
            >
              <img src={reactLogo} className="h-24 w-24" alt="React logo" />
            </a>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">
              Try it out!
            </h2>
            <form
              className="flex flex-col sm:flex-row gap-4"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input
                id="greet-input"
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Enter your name..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Greet
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
                Fast & Secure
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Built with Tauri for native performance and security
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
                Modern UI
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Powered by React and Tailwind CSS
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
                Developer Friendly
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Hot reloading and great developer experience
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
