import argparse
import threading
import webbrowser

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Simulador do MIC-1")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--porta", type=int, default=8765)
    parser.add_argument("--abrir", action="store_true", help="abre o navegador ao iniciar")
    args = parser.parse_args()

    if args.abrir:
        url = f"http://{args.host}:{args.porta}"
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    uvicorn.run("mic1.api:app", host=args.host, port=args.porta)


if __name__ == "__main__":
    main()
