import Session from "./session.js"

export async function useMongoAuthState() {

  const writeData = async (data, key) => {
    await Session.findOneAndUpdate(
      { key },
      { value: data },
      { upsert: true }
    )
  }

  const readData = async (key) => {
    const data = await Session.findOne({ key })
    return data?.value || null
  }

  const state = {
    creds: (await readData("creds")) || {},
    keys: {
      get: async (type, ids) => {
        let data = {}
        for (let id of ids) {
          data[id] = await readData(type + "-" + id)
        }
        return data
      },
      set: async (data) => {
        for (let type in data) {
          for (let id in data[type]) {
            await writeData(data[type][id], type + "-" + id)
          }
        }
      }
    }
  }

  const saveCreds = async () => {
    await writeData(state.creds, "creds")
  }

  return { state, saveCreds }
}
