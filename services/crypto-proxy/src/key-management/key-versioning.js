// Every encrypted record stores keyVersion. Read uses same version, write uses latest.
function versionOf(record) {
  return record.keyVersion || 1;
}

module.exports = { versionOf };
