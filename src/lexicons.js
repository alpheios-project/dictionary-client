import {LanguageModelFactory} from 'alpheios-data-models'
import AlpheiosLexAdapter from './alpheios/alpheios_adapter'

let lexicons = new Map() // Maps a language ID into an array of lexicons

export default class Lexicons {
  /**
   * Default request parameters
   * @return {{timeout: number}}
   */
  static get defaults () {
    return {
      timeout: 0 // If zero, no timeout will be used
    }
  }

  /**
   * A short definition request wrapper. See fetchFullDefs for more details.
   * @param lemma
   * @param options
   * @return {Promise[]}
   */
  static fetchShortDefs (lemma, options = {}) {
    return Lexicons.fetchDefinitions(lemma, options, 'lookupShortDef')
  }

  /**
   * A full definition request wrapper. See fetchFullDefs for more details.
   * @param lemma
   * @param options
   * @return {Promise[]}
   */
  static fetchFullDefs (lemma, options = {}) {
    return Lexicons.fetchDefinitions(lemma, options, 'lookupFullDef')
  }

  /**
   * Send requests to either short of full definitions depending on the `lookupFunction` value.
   * @param {Lemma} lemma - A lemma we need definitions for.
   * @param {Object} requestOptions - With what options run a request.
   * @param {String} lookupFunction - A name of an adapter lookup function to use for a request.
   * @return {Promise[]} Array of Promises, one for each request. They will be either fulfilled with
   * a Definition object or resolved with an error if request cannot be made/failed/timeout expired.
   */
  static fetchDefinitions (lemma, requestOptions, lookupFunction) {
    let options = Object.assign(Lexicons.defaults, requestOptions)
    let requests = []
    try {
      let adapters = Lexicons._filterAdapters(lemma, requestOptions)
      requests = adapters.map(adapter => {
        if (typeof window !== 'undefined') {
          console.log(`Preparing a request to "${adapter.config.description}"`)
        }
        return new Promise((resolve, reject) => {
          let timeout = 0
          if (options.timeout > 0) {
            if (typeof window !== 'undefined') {
              timeout = window.setTimeout(() => {
                reject(new Error(`Timeout of ${options.timeout} ms has been expired for a request to "${adapter.config.description}"`))
              }, options.timeout)
            } else {
              timeout = setTimeout(() => {
                reject(new Error(`Timeout of ${options.timeout} ms has been expired for a request to "${adapter.config.description}"`))
              }, options.timeout)
            }
          }

          try {
            adapter[lookupFunction](lemma)
              .then(value => {
                if (typeof window !== 'undefined') {
                  console.log(`A definition object has been returned from "${adapter.config.description}"`, value)
                }
                if (timeout) {
                  if (typeof window !== 'undefined') {
                    window.clearTimeout(timeout)
                  } else {
                    clearTimeout(timeout)
                  }
                }
                // value is a Definition object wrapped in a Proxy
                resolve(value)
              }).catch(error => {
                if (timeout) {
                  if (typeof window !== 'undefined') {
                    window.clearTimeout(timeout)
                  } else {
                    clearTimeout(timeout)
                  }
                }
                reject(error)
              })
          } catch (error) {
            reject(error)
          }
        })
      })

      return requests
    } catch (error) {
      console.log(`Unable to fetch full definitions due to: ${error}`)
      return []
    }
  }

  /**
   * Filter the adapters for a request according to the options
   * @param {Lemma} lemma - the requested lemma
   * @param {Object} objects - the request options
   * @return the list of applicable Adapters
   */
  static _filterAdapters (lemma, options) {
    if (typeof window !== 'undefined') {
      console.log('Request Options', options)
    }
    let adapters = Lexicons.getLexiconAdapters(lemma.languageID)
    if (adapters && options.allow) {
      adapters = adapters.filter((a) => options.allow.includes(a.lexid))
    }
    if (!adapters || adapters.length === 0) { return [] } // No adapters found for this language
    return adapters
  }

  /**
   * Returns a list of suitable lexicon adapters for a given language ID.
   * @param {Symbol} languageID - A language ID of adapters returned.
   * @return {BaseLexiconAdapter[]} An array of lexicon adapters for a given language.
   */
  static getLexiconAdapters (languageID) {
    if (!lexicons.has(languageID)) {
      // As getLexicons need a language code, let's convert a language ID to a code
      let languageCode = LanguageModelFactory.getLanguageCodeFromId(languageID)

      let lexiconsList = AlpheiosLexAdapter.getLexicons(languageCode)
      lexicons.set(languageID, Array.from(lexiconsList.keys()).map(id => new AlpheiosLexAdapter(id)))
    }
    return lexicons.get(languageID)
  }
}
