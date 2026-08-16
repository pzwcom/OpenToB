import { makeAutoObservable } from 'mobx'

class EncyclopediaStore {
  constructor() {
    this.query = ''
    this.activeCategory = ''
    this.activeSub = ''
    this.detail = null
    makeAutoObservable(this)
  }

  setQuery(value) {
    this.query = value
  }

  setCategory(value) {
    this.activeCategory = value
  }

  setSub(value) {
    this.activeSub = value
  }

  setDetail(value) {
    this.detail = value
  }

  handleSearch(value) {
    this.query = (value || '').trim()
    this.activeCategory = ''
    this.activeSub = ''
    this.detail = null
  }

  reset() {
    this.query = ''
    this.activeCategory = ''
    this.activeSub = ''
    this.detail = null
  }
}

export const encyclopediaStore = new EncyclopediaStore()
