#Requires -Version 5.0

[CmdletBinding()]
param (
    [string] $Source = "Doukutsu.exe",
    [string] $Destination = "PIXTONEPARAMS"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 3.0

if ((Get-FileHash -LiteralPath $Source).Hash -notin (
    "E02CC98F5914EC80ABE2B6190CF158B889DB08AE3FA3EB8074283495E8AD770B", # Japanese
    "FA18379FE942ECB5FD69360EDE81675AD6BB8B743BEF2120305C4B439C732218"  # English
)) {
    throw "Unrecognized Cave Story executable."
}

$inputStream = $null
$outputStream = $null
try {
    $inputStream = [System.IO.File]::OpenRead($Source)
    $outputStream = [System.IO.File]::OpenWrite($Destination)

    # PixTone parameter data begins at offset 0x8F940.
    $null = $inputStream.Seek(0x8F940, "Begin")

    # Each entry is 112 bytes in size and there are 139 entries in total.
    $remaining = 112 * 139

    $buffer = [byte[]]::new(4096)
    do {
        $bytesRead = $inputStream.Read($buffer, 0, [System.Math]::Min($buffer.Length, $remaining))
        $outputStream.Write($buffer, 0, $bytesRead)
        $remaining -= $bytesRead
    } while ($remaining -gt 0 -and $bytesRead -gt 0)
} finally {
    if ($inputStream -is [System.IDisposable]) {
        $inputStream.Dispose()
    }
    if ($outputStream -is [System.IDisposable]) {
        $outputStream.Dispose()
    }
}
