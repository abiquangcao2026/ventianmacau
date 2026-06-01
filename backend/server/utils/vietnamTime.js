const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function getVietnamDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(new Date(date))
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  }
}

function getStartOfVietnamDay(date = new Date()) {
  const { year, month, day } = getVietnamDateParts(date)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return new Date(`${year}-${mm}-${dd}T00:00:00+07:00`)
}

module.exports = {
  VIETNAM_TIME_ZONE,
  getStartOfVietnamDay
}
