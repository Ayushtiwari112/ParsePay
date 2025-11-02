import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const Dashboard = () => {
  const { user, logout } = useAuth()
  const [statements, setStatements] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    fetchStatements()
  }, [])

  const fetchStatements = async () => {
    try {
      const response = await axios.get('/api/statements')
      setStatements(response.data)
    } catch (error) {
      console.error('Error fetching statements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file')
        return
      }
      setSelectedFile(file)
      setError('')
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select a PDF file')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('pdf', selectedFile)

    try {
      const response = await axios.post('/api/statements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSuccess('✅ PDF parsed successfully!')
      setSelectedFile(null)
      document.getElementById('pdf-upload').value = ''
      fetchStatements()
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to upload and parse PDF')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this statement?')) {
      try {
        await axios.delete(`/api/statements/${id}`)
        fetchStatements()
        setSuccess('Statement deleted successfully')
      } catch (error) {
        setError('Failed to delete statement')
      }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-purple-100 fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-2xl shadow-md p-6 mb-6 card-hover">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-md">
                ParsePay
              </h1>
              <p className="text-gray-700 mt-1 font-medium">
                Welcome back, {user?.username} 👋
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md btn-glow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="glass rounded-2xl shadow-md p-6 mb-6 card-hover">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload PDF Statement
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select PDF File
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md btn-glow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading and parsing...' : 'Upload & Parse PDF'}
            </button>
          </form>
          <div className="mt-4 text-sm text-gray-700">
            <p className="font-medium mb-2">Supported Providers:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>HDFC Bank</li>
              <li>SBI</li>
              <li>ICICI Bank</li>
              <li>Axis Bank</li>
            </ul>
          </div>
        </div>

        {/* Statements List */}
        <div className="glass rounded-2xl shadow-md p-6 card-hover">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Parsed Statements
          </h2>
          {loading ? (
            <div className="text-center py-8 text-gray-600 animate-pulse">
              Loading...
            </div>
          ) : statements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No statements parsed yet. Upload a PDF to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {statements.map((statement) => (
                <div
                  key={statement._id}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 ease-in-out bg-white/60 backdrop-blur-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {statement.provider}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {statement.originalFilename}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Parsed: {formatDate(statement.parsedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(statement._id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded btn-glow hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Info label="Account Holder" value={statement.extractedData?.accountHolderName} />
                    <Info label="Card Last 4 Digits" value={statement.extractedData?.cardLast4 ? `****${statement.extractedData.cardLast4}` : 'N/A'} />
                    <Info label="Card Variant" value={statement.extractedData?.cardVariant} />
                    <Info
                      label="Billing Cycle"
                      value={
                        statement.extractedData?.billingCycleStart &&
                        statement.extractedData?.billingCycleEnd
                          ? `${formatDate(statement.extractedData.billingCycleStart)} - ${formatDate(statement.extractedData.billingCycleEnd)}`
                          : 'N/A'
                      }
                    />
                    <Info label="Payment Due Date" value={formatDate(statement.extractedData?.paymentDueDate)} />
                    <Info
                      label="Total Balance"
                      value={
                        statement.extractedData?.totalBalance
                          ? `₹${parseFloat(statement.extractedData.totalBalance).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}`
                          : 'N/A'
                      }
                    />
                    <Info
                      label="Minimum Due"
                      value={
                        statement.extractedData?.minimumDue
                          ? `₹${parseFloat(statement.extractedData.minimumDue).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}`
                          : 'N/A'
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const Info = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="text-sm text-gray-900">{value || 'N/A'}</p>
  </div>
)

export default Dashboard
