package main

import (
	"encoding/json"
	"syscall/js"

	photonparser "github.com/AutoDruid/photon-parser"
)

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func toJSONString(v interface{}) js.Value {
	b, err := json.Marshal(v)
	if err != nil {
		b, _ = json.Marshal(Response{Success: false, Error: err.Error()})
	}
	return js.ValueOf(string(b))
}

func errJSON(msg string) js.Value {
	return toJSONString(Response{Success: false, Error: msg})
}

func doParsing(_ js.Value, args []js.Value) any {

	if len(args) < 1 {
		return errJSON("no data provided")
	}

	if len(args) < 2 {
		return errJSON("no version provided")
	}

	jsVal := args[0]
	version := args[1].String()
	length := jsVal.Length()

	// Copy JS Uint8Array → Go []byte
	data := make([]byte, length)
	js.CopyBytesToGo(data, jsVal)

	switch version {
	case "v16":
		parser, err := photonparser.ParsePacketV16(data)
		if err != nil {
			return errJSON(err.Error())
		}
		return toJSONString(parser)
	case "v18":
		parser, err := photonparser.ParsePacketV18(data)
		if err != nil {
			return errJSON(err.Error())
		}

		return toJSONString(parser)
	default:
		return errJSON("invalid version")
	}

}

func main() {

	js.Global().Set("doParsing", js.FuncOf(doParsing))
	select {}
}
