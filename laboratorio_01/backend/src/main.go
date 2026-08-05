package main

import (
	"encoding/json"
	"net/http"
	"time"
)

type Response struct {
	Mensaje   string `json:"mensaje"`
	FechaHora string `json:"fecha_hora"`
}

func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(Response{
		Mensaje:   "Hola Mundo",
		FechaHora: time.Now().Format("2006-01-02 15:04:05"),
	})
}

func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}
